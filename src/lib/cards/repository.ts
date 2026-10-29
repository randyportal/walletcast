import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { cards, messages, subscribers, type Card, type Message, type NewCard } from "@/lib/db/schema";
import type { CardInput } from "./validation";

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`The link "${slug}" is already used by another card`);
    this.name = "SlugTakenError";
  }
}

export interface CardWithStats extends Card {
  appleSubscribers: number;
  googleSubscribers: number;
}

export interface CardImages {
  logo?: Buffer | null;
  icon?: Buffer | null;
  background?: Buffer | null;
  favicon?: Buffer | null;
  appleImage?: Buffer | null;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createCardRepository(db: Db) {
  async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const rows = await db.select({ id: cards.id }).from(cards).where(eq(cards.slug, slug));
    return rows.some((r) => r.id !== exceptId);
  }

  return {
    async create(organizationId: string, input: CardInput, images: CardImages = {}): Promise<Card> {
      if (await slugExists(input.slug)) throw new SlugTakenError(input.slug);
      try {
        const [card] = await db
          .insert(cards)
          .values({
            ...input,
            organizationId,
            logo: images.logo ?? null,
            icon: images.icon ?? null,
            backgroundImage: images.background ?? null,
            favicon: images.favicon ?? null,
            appleImage: images.appleImage ?? null,
          })
          .returning();
        return card;
      } catch (error) {
        if (isUniqueViolation(error)) throw new SlugTakenError(input.slug);
        throw error;
      }
    },

    async update(organizationId: string, id: string, input: CardInput, images: CardImages = {}): Promise<Card | null> {
      if (await slugExists(input.slug, id)) throw new SlugTakenError(input.slug);
      const patch: Partial<NewCard> = { ...input };
      if (images.logo !== undefined) patch.logo = images.logo;
      if (images.icon !== undefined) patch.icon = images.icon;
      if (images.background !== undefined) patch.backgroundImage = images.background;
      if (images.favicon !== undefined) patch.favicon = images.favicon;
      if (images.appleImage !== undefined) patch.appleImage = images.appleImage;
      const now = new Date();
      return db.transaction(async (tx) => {
        const [card] = await tx
          .update(cards)
          .set({ ...patch, updatedAt: now })
          .where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)))
          .returning();
        if (!card) return null;
        await tx
          .update(subscribers)
          .set({ updatedAt: now })
          .where(and(eq(subscribers.cardId, id), eq(subscribers.status, "active")));
        return card;
      });
    },

    async findById(organizationId: string, id: string): Promise<Card | null> {
      if (!UUID_PATTERN.test(id)) return null;
      const [card] = await db
        .select()
        .from(cards)
        .where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)));
      return card ?? null;
    },

    async findByIdAny(id: string): Promise<Card | null> {
      if (!UUID_PATTERN.test(id)) return null;
      const [card] = await db.select().from(cards).where(eq(cards.id, id));
      return card ?? null;
    },

    async findBySlug(slug: string): Promise<Card | null> {
      const [card] = await db.select().from(cards).where(eq(cards.slug, slug));
      return card ?? null;
    },

    async listWithStats(organizationId: string): Promise<CardWithStats[]> {
      const rows = await db
        .select()
        .from(cards)
        .where(and(eq(cards.organizationId, organizationId), isNull(cards.archivedAt)))
        .orderBy(desc(cards.createdAt));
      const counts = await db
        .select({ cardId: subscribers.cardId, platform: subscribers.platform, n: count() })
        .from(subscribers)
        .where(and(eq(subscribers.organizationId, organizationId), eq(subscribers.status, "active")))
        .groupBy(subscribers.cardId, subscribers.platform);
      return rows.map((card) => ({
        ...card,
        appleSubscribers: counts.find((c) => c.cardId === card.id && c.platform === "apple")?.n ?? 0,
        googleSubscribers: counts.find((c) => c.cardId === card.id && c.platform === "google")?.n ?? 0,
      }));
    },

    async archive(organizationId: string, id: string): Promise<Card | null> {
      const [card] = await db
        .update(cards)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)))
        .returning();
      return card ?? null;
    },

    async unarchive(organizationId: string, id: string): Promise<Card | null> {
      const [card] = await db
        .update(cards)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)))
        .returning();
      return card ?? null;
    },

    async listArchived(organizationId: string): Promise<Card[]> {
      return db
        .select()
        .from(cards)
        .where(and(eq(cards.organizationId, organizationId), sql`${cards.archivedAt} is not null`))
        .orderBy(desc(cards.archivedAt));
    },

    async delete(organizationId: string, id: string): Promise<void> {
      await db.delete(cards).where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)));
    },

    async setLatestMessage(organizationId: string, id: string, text: string, at: Date): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .update(cards)
          .set({ latestMessage: text, latestMessageAt: at, updatedAt: at })
          .where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)));
        await tx
          .update(subscribers)
          .set({ updatedAt: at })
          .where(and(eq(subscribers.cardId, id), eq(subscribers.status, "active")));
      });
    },

    async listDayGlow(): Promise<Card[]> {
      return db.select().from(cards).where(eq(cards.dayGlow, true));
    },

    async markGlowSlot(organizationId: string, id: string, slot: number, at: Date): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .update(cards)
          .set({ glowSlot: slot, updatedAt: at })
          .where(and(eq(cards.id, id), eq(cards.organizationId, organizationId)));
        await tx
          .update(subscribers)
          .set({ updatedAt: at })
          .where(and(eq(subscribers.cardId, id), eq(subscribers.status, "active")));
      });
    },

    async listMessages(organizationId: string, cardId: string, limit = 50): Promise<Message[]> {
      return db
        .select()
        .from(messages)
        .where(and(eq(messages.cardId, cardId), eq(messages.organizationId, organizationId)))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
    },

    async countMessagesSince(organizationId: string, cardId: string, since: Date): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.cardId, cardId),
            eq(messages.organizationId, organizationId),
            sql`${messages.createdAt} >= ${since.toISOString()}`,
          ),
        );
      return row?.n ?? 0;
    },
  };
}

export type CardRepository = ReturnType<typeof createCardRepository>;
