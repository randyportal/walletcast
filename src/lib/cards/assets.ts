import { and, eq, notInArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { cardAssets, type CardAsset } from "@/lib/db/schema";

export interface NewAssetInput {
  cardId: string;
  kind: string;
  mime: string;
  data: Buffer;
}

export function createAssetRepository(db: Db) {
  return {
    async create(input: NewAssetInput): Promise<CardAsset> {
      const [row] = await db
        .insert(cardAssets)
        .values({ cardId: input.cardId, kind: input.kind, mime: input.mime, data: input.data })
        .returning();
      return row;
    },

    async findById(id: string): Promise<CardAsset | null> {
      const [row] = await db.select().from(cardAssets).where(eq(cardAssets.id, id));
      return row ?? null;
    },

    async deleteUnreferenced(cardId: string, keepIds: string[]): Promise<void> {
      if (keepIds.length === 0) {
        await db.delete(cardAssets).where(eq(cardAssets.cardId, cardId));
        return;
      }
      await db
        .delete(cardAssets)
        .where(and(eq(cardAssets.cardId, cardId), notInArray(cardAssets.id, keepIds)));
    },
  };
}

export type AssetRepository = ReturnType<typeof createAssetRepository>;
