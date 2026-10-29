import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  cardTransactions,
  cards,
  customers,
  issuedCards,
  type Card,
  type CardTransaction,
  type CardTransactionType,
  type Customer,
  type IssuedCard,
  type IssuedCardStatus,
  type OrganizationRole,
} from "@/lib/db/schema";

export class IssuedCardNotFoundError extends Error {
  constructor() {
    super("Tarjeta emitida no encontrada");
    this.name = "IssuedCardNotFoundError";
  }
}

export class IssuedCardStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IssuedCardStateError";
  }
}

export interface LoyaltyActor {
  userId?: string | null;
  name?: string | null;
  role?: OrganizationRole | null;
}

export interface IssuedCardRow {
  issuedCard: IssuedCard;
  card: Card;
  customer: Customer;
}

export interface PassData {
  issuedCard: IssuedCard;
  card: Card;
  customer: Customer;
  transactions: CardTransaction[];
}

export interface TransactionRow {
  transaction: CardTransaction;
  issuedCard: IssuedCard;
  card: Card;
  customer: Customer;
}

export interface IssuedCardListOptions {
  search?: string;
  status?: IssuedCardStatus;
  cardId?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionListOptions {
  search?: string;
  type?: CardTransactionType;
  customerId?: string;
  cardId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function actorValues(actor: LoyaltyActor = {}) {
  return {
    actorUserId: actor.userId ?? null,
    actorName: actor.name ?? null,
    actorRole: actor.role ?? null,
  };
}

export function createLoyaltyRepository(db: Db) {
  async function findActive(
    organizationId: string,
    cardId: string,
    customerId: string,
  ): Promise<IssuedCard | null> {
    const [row] = await db
      .select()
      .from(issuedCards)
      .where(
        and(
          eq(issuedCards.organizationId, organizationId),
          eq(issuedCards.cardId, cardId),
          eq(issuedCards.customerId, customerId),
          eq(issuedCards.status, "active"),
        ),
      );
    return row ?? null;
  }

  return {
    async create(input: {
      organizationId: string;
      cardId: string;
      customerId: string;
      actor?: LoyaltyActor;
      remarks?: string | null;
    }): Promise<{ issuedCard: IssuedCard; created: boolean }> {
      const existing = await findActive(input.organizationId, input.cardId, input.customerId);
      if (existing) return { issuedCard: existing, created: false };
      try {
        const issuedCard = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(issuedCards)
            .values({
              organizationId: input.organizationId,
              cardId: input.cardId,
              customerId: input.customerId,
              lastVisitAt: new Date(),
            })
            .returning();
          await tx.insert(cardTransactions).values({
            organizationId: input.organizationId,
            issuedCardId: row.id,
            type: "issued",
            amount: 0,
            remarks: input.remarks ?? null,
            ...actorValues(input.actor),
          });
          return row;
        });
        return { issuedCard, created: true };
      } catch (error) {
        if (isUniqueViolation(error)) {
          const row = await findActive(input.organizationId, input.cardId, input.customerId);
          if (row) return { issuedCard: row, created: false };
        }
        throw error;
      }
    },

    async findById(organizationId: string, id: string): Promise<IssuedCard | null> {
      const [row] = await db
        .select()
        .from(issuedCards)
        .where(and(eq(issuedCards.id, id), eq(issuedCards.organizationId, organizationId)));
      return row ?? null;
    },

    async findByIdRow(organizationId: string, id: string): Promise<IssuedCardRow | null> {
      const [row] = await db
        .select({ issuedCard: issuedCards, card: cards, customer: customers })
        .from(issuedCards)
        .innerJoin(cards, eq(cards.id, issuedCards.cardId))
        .innerJoin(customers, eq(customers.id, issuedCards.customerId))
        .where(and(eq(issuedCards.id, id), eq(issuedCards.organizationId, organizationId)));
      return row ?? null;
    },

    async findByToken(token: string, organizationId?: string): Promise<IssuedCardRow | null> {
      const conditions = [eq(issuedCards.token, token)];
      if (organizationId) conditions.push(eq(issuedCards.organizationId, organizationId));
      const [row] = await db
        .select({ issuedCard: issuedCards, card: cards, customer: customers })
        .from(issuedCards)
        .innerJoin(cards, eq(cards.id, issuedCards.cardId))
        .innerJoin(customers, eq(customers.id, issuedCards.customerId))
        .where(and(...conditions));
      return row ?? null;
    },

    async getPassData(issuedCardId: string): Promise<PassData | null> {
      const [row] = await db
        .select({ issuedCard: issuedCards, card: cards, customer: customers })
        .from(issuedCards)
        .innerJoin(cards, eq(cards.id, issuedCards.cardId))
        .innerJoin(customers, eq(customers.id, issuedCards.customerId))
        .where(eq(issuedCards.id, issuedCardId));
      if (!row) return null;
      const transactions = await db
        .select()
        .from(cardTransactions)
        .where(eq(cardTransactions.issuedCardId, issuedCardId))
        .orderBy(cardTransactions.createdAt);
      return { ...row, transactions };
    },

    async list(organizationId: string, options: IssuedCardListOptions = {}): Promise<IssuedCardRow[]> {
      const conditions = [eq(issuedCards.organizationId, organizationId)];
      if (options.status) conditions.push(eq(issuedCards.status, options.status));
      if (options.cardId) conditions.push(eq(issuedCards.cardId, options.cardId));
      if (options.customerId) conditions.push(eq(issuedCards.customerId, options.customerId));
      if (options.search) {
        const query = `%${options.search}%`;
        conditions.push(
          or(
            ilike(customers.name, query),
            ilike(customers.email, query),
            ilike(customers.mobile, query),
            ilike(cards.name, query),
            sql`${issuedCards.token}::text ilike ${query}`,
          )!,
        );
      }
      return db
        .select({ issuedCard: issuedCards, card: cards, customer: customers })
        .from(issuedCards)
        .innerJoin(cards, eq(cards.id, issuedCards.cardId))
        .innerJoin(customers, eq(customers.id, issuedCards.customerId))
        .where(and(...conditions))
        .orderBy(desc(issuedCards.createdAt))
        .limit(options.limit ?? 100)
        .offset(options.offset ?? 0);
    },

    async listForCustomer(organizationId: string, customerId: string): Promise<IssuedCardRow[]> {
      return this.list(organizationId, { customerId, limit: 200 });
    },

    async listForCard(organizationId: string, cardId: string): Promise<IssuedCardRow[]> {
      return this.list(organizationId, { cardId, limit: 500 });
    },

    async addStamp(input: {
      organizationId: string;
      issuedCardId: string;
      maxStamps: number;
      actor?: LoyaltyActor;
      remarks?: string | null;
    }): Promise<IssuedCard> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(issuedCards)
          .set({
            stamps: sql`${issuedCards.stamps} + 1`,
            lastVisitAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(issuedCards.id, input.issuedCardId),
              eq(issuedCards.organizationId, input.organizationId),
              eq(issuedCards.status, "active"),
              sql`${issuedCards.stamps} < ${input.maxStamps}`,
            ),
          )
          .returning();
        if (!row) throw new IssuedCardStateError("No se puede agregar otro sello a esta tarjeta.");
        await tx.insert(cardTransactions).values({
          organizationId: input.organizationId,
          issuedCardId: row.id,
          type: "stamp_add",
          amount: 1,
          remarks: input.remarks ?? null,
          ...actorValues(input.actor),
        });
        return row;
      });
    },

    async removeStamp(input: {
      organizationId: string;
      issuedCardId: string;
      actor?: LoyaltyActor;
      remarks?: string | null;
    }): Promise<IssuedCard> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(issuedCards)
          .set({
            stamps: sql`${issuedCards.stamps} - 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(issuedCards.id, input.issuedCardId),
              eq(issuedCards.organizationId, input.organizationId),
              eq(issuedCards.status, "active"),
              sql`${issuedCards.stamps} > 0`,
            ),
          )
          .returning();
        if (!row) throw new IssuedCardStateError("No se puede quitar un sello de esta tarjeta.");
        await tx.insert(cardTransactions).values({
          organizationId: input.organizationId,
          issuedCardId: row.id,
          type: "stamp_remove",
          amount: -1,
          remarks: input.remarks ?? null,
          ...actorValues(input.actor),
        });
        return row;
      });
    },

    async redeem(input: {
      organizationId: string;
      issuedCardId: string;
      requiredStamps: number;
      remarks?: string | null;
      actor?: LoyaltyActor;
    }): Promise<IssuedCard> {
      return db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
          .update(issuedCards)
          .set({ status: "redeemed", completedAt: now, updatedAt: now })
          .where(
            and(
              eq(issuedCards.id, input.issuedCardId),
              eq(issuedCards.organizationId, input.organizationId),
              eq(issuedCards.status, "active"),
              sql`${issuedCards.stamps} >= ${input.requiredStamps}`,
            ),
          )
          .returning();
        if (!row) throw new IssuedCardStateError("La tarjeta no está lista para canjear.");
        await tx.insert(cardTransactions).values({
          organizationId: input.organizationId,
          issuedCardId: row.id,
          type: "redeem",
          amount: 0,
          remarks: input.remarks ?? null,
          ...actorValues(input.actor),
        });
        return row;
      });
    },

    async revoke(input: {
      organizationId: string;
      issuedCardId: string;
      remarks?: string | null;
      actor?: LoyaltyActor;
    }): Promise<IssuedCard> {
      return db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
          .update(issuedCards)
          .set({ status: "revoked", revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(issuedCards.id, input.issuedCardId),
              eq(issuedCards.organizationId, input.organizationId),
              sql`${issuedCards.status} <> 'revoked'`,
            ),
          )
          .returning();
        if (!row) throw new IssuedCardStateError("La tarjeta ya está revocada.");
        await tx.insert(cardTransactions).values({
          organizationId: input.organizationId,
          issuedCardId: row.id,
          type: "revoke",
          amount: 0,
          remarks: input.remarks ?? null,
          ...actorValues(input.actor),
        });
        return row;
      });
    },

    async listTransactions(
      organizationId: string,
      options: TransactionListOptions = {},
    ): Promise<TransactionRow[]> {
      const conditions = [eq(cardTransactions.organizationId, organizationId)];
      if (options.type) conditions.push(eq(cardTransactions.type, options.type));
      if (options.customerId) conditions.push(eq(issuedCards.customerId, options.customerId));
      if (options.cardId) conditions.push(eq(issuedCards.cardId, options.cardId));
      if (options.from) conditions.push(gte(cardTransactions.createdAt, options.from));
      if (options.to) conditions.push(lte(cardTransactions.createdAt, options.to));
      if (options.search) {
        const query = `%${options.search}%`;
        conditions.push(
          or(
            ilike(customers.name, query),
            ilike(customers.email, query),
            ilike(customers.mobile, query),
            ilike(cards.name, query),
            ilike(cardTransactions.remarks, query),
            sql`${issuedCards.token}::text ilike ${query}`,
          )!,
        );
      }
      return db
        .select({
          transaction: cardTransactions,
          issuedCard: issuedCards,
          card: cards,
          customer: customers,
        })
        .from(cardTransactions)
        .innerJoin(issuedCards, eq(issuedCards.id, cardTransactions.issuedCardId))
        .innerJoin(cards, eq(cards.id, issuedCards.cardId))
        .innerJoin(customers, eq(customers.id, issuedCards.customerId))
        .where(and(...conditions))
        .orderBy(desc(cardTransactions.createdAt))
        .limit(options.limit ?? 200)
        .offset(options.offset ?? 0);
    },

    async countForOrganization(organizationId: string): Promise<{ total: number; active: number; redeemed: number; revoked: number }> {
      const rows = await db
        .select({ status: issuedCards.status, n: count() })
        .from(issuedCards)
        .where(eq(issuedCards.organizationId, organizationId))
        .groupBy(issuedCards.status);
      const at = (status: IssuedCardStatus) => rows.find((row) => row.status === status)?.n ?? 0;
      return {
        total: rows.reduce((sum, row) => sum + row.n, 0),
        active: at("active"),
        redeemed: at("redeemed"),
        revoked: at("revoked"),
      };
    },
  };
}

export type LoyaltyRepository = ReturnType<typeof createLoyaltyRepository>;
