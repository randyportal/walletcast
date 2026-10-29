import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/testing/db";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/constants";
import { createCardRepository } from "@/lib/cards/repository";
import { CardInputSchema } from "@/lib/cards/validation";
import { createCustomerRepository } from "@/lib/customers/repository";
import { CustomerInputSchema } from "@/lib/customers/validation";
import { createSubscriberRepository } from "@/lib/subscribers/repository";
import { createLoyaltyRepository } from "./repository";
import { syncIssuedCardWallet } from "./sync";

describe("wallet sync", () => {
  it("pushes Apple and patches Google with loyalty data", async () => {
    const db = await createTestDb();
    const cards = createCardRepository(db);
    const customers = createCustomerRepository(db);
    const loyalty = createLoyaltyRepository(db);
    const subscribers = createSubscriberRepository(db);
    const card = await cards.create(
      DEFAULT_ORGANIZATION_ID,
      CardInputSchema.parse({ name: "Café", organizationName: "Café", slug: "cafe-sync", loyaltyEnabled: "on", stampsRequired: 3, rewardName: "Café gratis" }),
    );
    const customer = await customers.create(
      DEFAULT_ORGANIZATION_ID,
      CustomerInputSchema.parse({ name: "Ana", email: "ana@example.com" }),
    );
    const { issuedCard } = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    const apple = await subscribers.create({
      organizationId: DEFAULT_ORGANIZATION_ID,
      cardId: card.id,
      issuedCardId: issuedCard.id,
      platform: "apple",
    });
    await subscribers.registerAppleDevice({
      deviceLibraryId: "device-1",
      pushToken: "a".repeat(64),
      serialNumber: apple.serialNumber,
      passTypeId: "pass.test",
    });
    await subscribers.create({
      organizationId: DEFAULT_ORGANIZATION_ID,
      cardId: card.id,
      issuedCardId: issuedCard.id,
      platform: "google",
    });
    const pushed: string[][] = [];
    const patched: string[] = [];
    const messages: string[] = [];
    const warnings = await syncIssuedCardWallet(
      {
        loyalty,
        subscribers,
        apns: {
          async sendPassUpdates(tokens) {
            pushed.push(tokens);
            return { sent: tokens.length, failed: 0, invalidTokens: [], errors: [] };
          },
        },
        google: {
          issuerId: "issuer",
          api: {
            async upsertGenericClass() {},
            async patchGenericObject(id) { patched.push(id); },
            async updateGenericObject() {},
            async addMessageToGenericObject(id) { messages.push(id); },
          },
        },
        baseUrl: "https://wc.test",
        timeZone: "America/Mexico_City",
      },
      issuedCard.id,
      { notify: { title: "Hola", body: "Mundo" } },
    );
    expect(warnings).toEqual([]);
    expect(pushed[0]).toEqual(["a".repeat(64)]);
    expect(patched).toHaveLength(1);
    expect(messages).toHaveLength(1);
  });

  it("links and reuses wallet subscribers per issued card", async () => {
    const db = await createTestDb();
    const cards = createCardRepository(db);
    const customers = createCustomerRepository(db);
    const loyalty = createLoyaltyRepository(db);
    const subscribers = createSubscriberRepository(db);
    const card = await cards.create(
      DEFAULT_ORGANIZATION_ID,
      CardInputSchema.parse({ name: "Café", organizationName: "Café", slug: "cafe-links", loyaltyEnabled: "on", stampsRequired: 3, rewardName: "Café gratis" }),
    );
    const customer = await customers.create(
      DEFAULT_ORGANIZATION_ID,
      CustomerInputSchema.parse({ name: "Ana", email: "ana-links@example.com" }),
    );
    const { issuedCard } = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    const apple = await subscribers.ensureForIssuedCard({
      organizationId: DEFAULT_ORGANIZATION_ID,
      cardId: card.id,
      issuedCardId: issuedCard.id,
      platform: "apple",
    });
    const sameApple = await subscribers.ensureForIssuedCard({
      organizationId: DEFAULT_ORGANIZATION_ID,
      cardId: card.id,
      issuedCardId: issuedCard.id,
      platform: "apple",
    });
    const google = await subscribers.ensureForIssuedCard({
      organizationId: DEFAULT_ORGANIZATION_ID,
      cardId: card.id,
      issuedCardId: issuedCard.id,
      platform: "google",
    });
    expect(sameApple.id).toBe(apple.id);
    expect((await subscribers.findForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id, "apple"))?.id).toBe(apple.id);
    expect(await subscribers.listForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id)).toHaveLength(2);
    expect(await subscribers.listActiveGoogleForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id)).toHaveLength(1);
    await subscribers.registerAppleDevice({
      deviceLibraryId: "device-links",
      pushToken: "b".repeat(64),
      serialNumber: apple.serialNumber,
      passTypeId: "pass.test",
    });
    expect(await subscribers.applePushTokensForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id)).toEqual(["b".repeat(64)]);
    await subscribers.touchForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id);
    await subscribers.revokeForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id);
    expect((await subscribers.findForIssuedCard(DEFAULT_ORGANIZATION_ID, issuedCard.id, "google"))?.status).toBe("removed");
    expect(google.platform).toBe("google");
  });
});
