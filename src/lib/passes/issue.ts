import { z } from "zod";
import type { AppConfig } from "@/lib/config/env";
import type { Card, Subscriber } from "@/lib/db/schema";
import type { SubscriberRepository } from "@/lib/subscribers/repository";
import type { CardRepository } from "@/lib/cards/repository";
import { normalizeContent, previousMessages } from "@/lib/cards/content";
import { buildApplePass } from "@/lib/apple/pass";
import { createSaveUrl, type GoogleWalletApi } from "@/lib/google/client";
import { buildGenericClass, buildGenericObject } from "@/lib/google/objects";
import type { LoyaltyPassData } from "@/lib/loyalty/wallet";

/** Public "add to wallet" form. Email is optional; `src` tracks the QR placement. */
export const IssueRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email().max(254).nullable())
    .optional()
    .default(null),
  src: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^[\w-]{1,40}$/).nullable())
    .optional()
    .default(null),
});

export type IssueRequest = z.infer<typeof IssueRequestSchema>;

export class PlatformDisabledError extends Error {
  constructor(platform: string) {
    super(`${platform} no está configurado en este servidor`);
    this.name = "PlatformDisabledError";
  }
}

export async function issueApplePass(
  config: AppConfig,
  cards: CardRepository,
  subscribers: SubscriberRepository,
  card: Card,
  request: IssueRequest,
  loyalty: LoyaltyPassData | null = null,
  existingSubscriber?: Subscriber,
  timeZone = config.glowTimeZone,
): Promise<Buffer> {
  if (!config.apple) throw new PlatformDisabledError("Apple Wallet");
  const limit = normalizeContent(card).config.latest.historyLimit + 1;
  const history = previousMessages(await cards.listMessages(card.organizationId, card.id, limit), card.latestMessage);
  const subscriber =
    existingSubscriber ??
    (await subscribers.create({
      organizationId: card.organizationId,
      cardId: card.id,
      platform: "apple",
      email: request.email,
      source: request.src,
    }));
  return buildApplePass({
    card,
    subscriber,
    apple: config.apple,
    baseUrl: config.baseUrl,
    history,
    timeZone,
    loyalty,
  });
}

export async function issueGooglePass(
  config: AppConfig,
  cards: CardRepository,
  subscribers: SubscriberRepository,
  api: GoogleWalletApi,
  card: Card,
  request: IssueRequest,
  loyalty: LoyaltyPassData | null = null,
  existingSubscriber?: Subscriber,
  timeZone = config.glowTimeZone,
): Promise<string> {
  if (!config.google) throw new PlatformDisabledError("Google Wallet");
  const limit = normalizeContent(card).config.latest.historyLimit + 1;
  const history = previousMessages(await cards.listMessages(card.organizationId, card.id, limit), card.latestMessage);
  await api.upsertGenericClass(buildGenericClass(config.google.issuerId, card));
  const subscriber =
    existingSubscriber ??
    (await subscribers.create({
      organizationId: card.organizationId,
      cardId: card.id,
      platform: "google",
      email: request.email,
      source: request.src,
    }));
  const object = buildGenericObject(
    config.google.issuerId,
    card,
    subscriber,
    config.baseUrl,
    history,
    loyalty,
    timeZone,
  );
  return createSaveUrl(config.google, object, config.baseUrl);
}
