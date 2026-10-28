import type { Db } from "@/lib/db/client";
import { messages, type Message } from "@/lib/db/schema";
import type { CardRepository } from "@/lib/cards/repository";
import type { SubscriberRepository } from "@/lib/subscribers/repository";
import type { MessageInput } from "@/lib/cards/validation";
import type { ApnsSender } from "@/lib/apple/apns";
import type { GoogleWalletApi } from "@/lib/google/client";
import { buildMessagePatch, buildNotifyMessage, objectId } from "@/lib/google/objects";
import { GoogleWalletError } from "@/lib/google/client";
import { normalizeContent } from "@/lib/cards/content";
import { mapWithConcurrency } from "@/lib/http/concurrency";

/** Google only shows ~3 notifying messages per pass per 24h. */
export const GOOGLE_DAILY_NOTIFICATION_LIMIT = 3;

export interface BroadcastDeps {
  db: Db;
  organizationId: string;
  baseUrl: string;
  cards: CardRepository;
  subscribers: SubscriberRepository;
  apns: ApnsSender | null;
  google: { api: GoogleWalletApi; issuerId: string } | null;
  now?: () => Date;
}

export interface BroadcastResult {
  message: Message;
  warnings: string[];
  errors: string[];
}

export class CardNotFoundError extends Error {
  constructor() {
    super("Tarjeta no encontrada");
    this.name = "CardNotFoundError";
  }
}

/** Text stored on the pass: this is what Apple shows in the lock-screen notification. */
export function passText(input: MessageInput): string {
  return `${input.title}: ${input.body}`;
}

export async function broadcast(
  deps: BroadcastDeps,
  cardId: string,
  input: MessageInput,
  sentBy?: string | null,
): Promise<BroadcastResult> {
  const now = deps.now?.() ?? new Date();
  const card = await deps.cards.findById(deps.organizationId, cardId);
  if (!card) throw new CardNotFoundError();

  const warnings: string[] = [];
  const errors: string[] = [];
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const messageText = passText(input);
  if (card.latestMessage === messageText) {
    warnings.push("El mensaje es idéntico al anterior: Apple Wallet no mostrará otra notificación.");
  }
  if ((await deps.cards.countMessagesSince(deps.organizationId, cardId, dayAgo)) >= GOOGLE_DAILY_NOTIFICATION_LIMIT) {
    warnings.push(
      `Más de ${GOOGLE_DAILY_NOTIFICATION_LIMIT} mensajes en 24 h: Google Wallet puede actualizar el pase sin notificar.`,
    );
  }

  const content = normalizeContent(card);
  const history = await deps.cards.listMessages(deps.organizationId, cardId, content.config.latest.historyLimit);
  await deps.cards.setLatestMessage(deps.organizationId, cardId, messageText, now);
  const updatedCard = { ...card, latestMessage: messageText, latestMessageAt: now, updatedAt: now };

  const sendApple = async () => {
    const result = { targets: 0, sent: 0, failed: 0 };
    const localErrors: string[] = [];
    if (deps.apns) {
      const tokens = await deps.subscribers.applePushTokensForCard(deps.organizationId, cardId);
      const pushed = await deps.apns.sendPassUpdates(tokens);
      await deps.subscribers.removeApplePushTokens(pushed.invalidTokens);
      result.targets = tokens.length;
      result.sent = pushed.sent;
      result.failed = pushed.failed;
      localErrors.push(...pushed.errors.map((e) => `Apple: ${e}`));
    }
    return { result, errors: localErrors };
  };

  const sendGoogle = async () => {
    const result = { targets: 0, sent: 0, failed: 0 };
    const localErrors: string[] = [];
    if (!deps.google) return { result, errors: localErrors };
    const { api, issuerId } = deps.google;
    const targets = await deps.subscribers.listActiveGoogle(deps.organizationId, cardId);
    const patch = buildMessagePatch(updatedCard, history);
    const messageId = `m${now.getTime()}`;
    const outcomes = await mapWithConcurrency(targets, 10, async (sub) => {
      const id = objectId(issuerId, sub);
      try {
        await api.patchGenericObject(id, patch);
        await api.addMessageToGenericObject(id, buildNotifyMessage(input.title, input.body, messageId));
        return null;
      } catch (error) {
        if (error instanceof GoogleWalletError && error.status === 404) {
          await deps.subscribers.setStatus(sub.serialNumber, "removed");
          return null;
        }
        return error instanceof Error ? error.message : String(error);
      }
    });
    const failures = outcomes.filter((o): o is string => o !== null);
    result.targets = targets.length;
    result.sent = targets.length - failures.length;
    result.failed = failures.length;
    localErrors.push(...failures.slice(0, 5).map((e) => `Google: ${e}`));
    return { result, errors: localErrors };
  };

  const [appleOutcome, googleOutcome] = await Promise.all([sendApple(), sendGoogle()]);
  const apple = appleOutcome.result;
  const google = googleOutcome.result;
  errors.push(...appleOutcome.errors, ...googleOutcome.errors);

  const [message] = await deps.db
    .insert(messages)
    .values({
      organizationId: deps.organizationId,
      cardId,
      title: input.title,
      body: input.body,
      sentBy: sentBy ?? null,
      createdAt: now,
      appleTargets: apple.targets,
      appleSent: apple.sent,
      appleFailed: apple.failed,
      googleTargets: google.targets,
      googleSent: google.sent,
      googleFailed: google.failed,
    })
    .returning();

  return { message, warnings, errors };
}
