import type { ApnsSender } from "@/lib/apple/apns";
import type { GoogleWalletApi } from "@/lib/google/client";
import { GoogleWalletError } from "@/lib/google/client";
import { buildNotifyMessage, buildObjectPatch, objectId } from "@/lib/google/objects";
import { mapWithConcurrency } from "@/lib/http/concurrency";
import type { SubscriberRepository } from "@/lib/subscribers/repository";
import type { LoyaltyRepository } from "./repository";

export interface LoyaltySyncDeps {
  loyalty: LoyaltyRepository;
  subscribers: SubscriberRepository;
  apns: ApnsSender | null;
  google: { api: GoogleWalletApi; issuerId: string } | null;
  baseUrl: string;
  timeZone: string;
}

export interface LoyaltySyncOptions {
  notify?: { title: string; body: string } | null;
}

export async function syncIssuedCardWallet(
  deps: LoyaltySyncDeps,
  issuedCardId: string,
  options: LoyaltySyncOptions = {},
): Promise<string[]> {
  const data = await deps.loyalty.getPassData(issuedCardId);
  if (!data) return ["Tarjeta emitida no encontrada para actualizar Wallet."];
  const warnings: string[] = [];

  if (deps.apns) {
    await deps.subscribers.touchForIssuedCard(data.issuedCard.organizationId, issuedCardId);
    const tokens = await deps.subscribers.applePushTokensForIssuedCard(
      data.issuedCard.organizationId,
      issuedCardId,
    );
    if (tokens.length > 0) {
      const pushed = await deps.apns.sendPassUpdates(tokens);
      await deps.subscribers.removeApplePushTokens(pushed.invalidTokens);
      warnings.push(...pushed.errors.map((error) => `Apple: ${error}`));
    }
  }

  if (!deps.google) return warnings;
  const { api, issuerId } = deps.google;
  const targets = await deps.subscribers.listActiveGoogleForIssuedCard(
    data.issuedCard.organizationId,
    issuedCardId,
  );
  const patch = buildObjectPatch(data.card, deps.baseUrl, [], data, deps.timeZone);
  const outcomes = await mapWithConcurrency(targets, 10, async (subscriber) => {
    const id = objectId(issuerId, subscriber);
    try {
      await api.patchGenericObject(id, patch);
      if (options.notify) {
        await api.addMessageToGenericObject(
          id,
          buildNotifyMessage(options.notify.title, options.notify.body, `l${Date.now()}-${subscriber.id.slice(0, 8)}`),
        );
      }
      return null;
    } catch (error) {
      if (error instanceof GoogleWalletError && error.status === 404) {
        await deps.subscribers.setStatus(subscriber.serialNumber, "removed");
        return null;
      }
      return error instanceof Error ? error.message : String(error);
    }
  });
  warnings.push(...outcomes.filter((value): value is string => value !== null).slice(0, 5).map((error) => `Google: ${error}`));
  return warnings;
}
