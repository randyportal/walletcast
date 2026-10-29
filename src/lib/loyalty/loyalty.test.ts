import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/testing/db";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/constants";
import { createCardRepository } from "@/lib/cards/repository";
import { CardInputSchema } from "@/lib/cards/validation";
import { createCustomerRepository } from "@/lib/customers/repository";
import { CustomerInputSchema } from "@/lib/customers/validation";
import { createLoyaltyRepository } from "./repository";
import {
  CustomerContactRequiredError,
  addStampForIssuedCard,
  joinPublicCard,
  issueCardForCustomer,
  redeemIssuedCard,
  revokeIssuedCard,
} from "./service";

const loyaltyCard = () =>
  CardInputSchema.parse({
    name: "Café Central",
    organizationName: "Café Central",
    slug: "cafe-central",
    loyaltyEnabled: "on",
    stampsRequired: 3,
    rewardName: "Café gratis",
    joinContactPolicy: "email_or_mobile",
  });

async function setup() {
  const db = await createTestDb();
  const cards = createCardRepository(db);
  const customers = createCustomerRepository(db);
  const loyalty = createLoyaltyRepository(db);
  const card = await cards.create(DEFAULT_ORGANIZATION_ID, loyaltyCard());
  const customer = await customers.create(
    DEFAULT_ORGANIZATION_ID,
    CustomerInputSchema.parse({ name: "Ana", email: "ana@example.com" }),
  );
  return { db, cards, customers, loyalty, card, customer };
}

describe("loyalty lifecycle", () => {
  it("issues one active card per customer/campaign and records the ledger", async () => {
    const { loyalty, card, customer } = await setup();
    const first = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    const second = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    expect(second.created).toBe(false);
    expect(second.issuedCard.id).toBe(first.issuedCard.id);
    const history = await loyalty.listTransactions(DEFAULT_ORGANIZATION_ID, {});
    expect(history[0].transaction.type).toBe("issued");
  });

  it("adds/removes stamps, redeems and revokes with audit actors", async () => {
    const { loyalty, card, customer } = await setup();
    const { issuedCard } = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    const actor = { userId: null, name: "Staff", role: "staff" as const };
    let updated = await loyalty.addStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, maxStamps: 3, actor });
    expect(updated.stamps).toBe(1);
    updated = await loyalty.removeStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, actor });
    expect(updated.stamps).toBe(0);
    await loyalty.addStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, maxStamps: 3 });
    await loyalty.addStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, maxStamps: 3 });
    await loyalty.addStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, maxStamps: 3 });
    const redeemed = await loyalty.redeem({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, requiredStamps: 3, actor });
    expect(redeemed.status).toBe("redeemed");
    const revoked = await loyalty.revoke({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, actor });
    expect(revoked.status).toBe("revoked");
    const history = await loyalty.listTransactions(DEFAULT_ORGANIZATION_ID, {});
    expect(history.map((row) => row.transaction.type)).toEqual(
      expect.arrayContaining(["issued", "stamp_add", "stamp_remove", "redeem", "revoke"]),
    );
  });

  it("looks up issued cards by token, customer and campaign", async () => {
    const { loyalty, card, customer } = await setup();
    const { issuedCard } = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    expect((await loyalty.findById(DEFAULT_ORGANIZATION_ID, issuedCard.id))?.id).toBe(issuedCard.id);
    expect((await loyalty.findByIdRow(DEFAULT_ORGANIZATION_ID, issuedCard.id))?.customer.id).toBe(customer.id);
    expect((await loyalty.findByToken(issuedCard.token))?.issuedCard.id).toBe(issuedCard.id);
    expect(await loyalty.findByToken(issuedCard.token, "00000000-0000-0000-0000-000000000099")).toBeNull();
    expect(await loyalty.listForCustomer(DEFAULT_ORGANIZATION_ID, customer.id)).toHaveLength(1);
    expect(await loyalty.listForCard(DEFAULT_ORGANIZATION_ID, card.id)).toHaveLength(1);
    expect(await loyalty.countForOrganization(DEFAULT_ORGANIZATION_ID)).toMatchObject({ total: 1, active: 1 });
  });

  it("keeps existing cards operable after the campaign is archived", async () => {
    const { cards, customers, loyalty, card, customer } = await setup();
    const { issuedCard } = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    await cards.archive(DEFAULT_ORGANIZATION_ID, card.id);
    const updated = await addStampForIssuedCard(
      { customers, loyalty },
      { organizationId: DEFAULT_ORGANIZATION_ID, card: { ...card, archivedAt: new Date() }, issuedCardId: issuedCard.id },
    );
    expect(updated.stamps).toBe(1);
    await expect(
      issueCardForCustomer({ customers, loyalty }, {
        organizationId: DEFAULT_ORGANIZATION_ID,
        card: { ...card, archivedAt: new Date() },
        customer,
      }),
    ).rejects.toThrow(/archivada/);
  });

  it("rejects adding beyond the reward threshold", async () => {
    const { loyalty, card, customer } = await setup();
    const { issuedCard } = await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    await loyalty.addStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, maxStamps: 1 });
    await expect(
      loyalty.addStamp({ organizationId: DEFAULT_ORGANIZATION_ID, issuedCardId: issuedCard.id, maxStamps: 1 }),
    ).rejects.toThrow(/No se puede agregar/);
  });
});

describe("public join", () => {
  it("creates a customer/card and reuses the active card by email", async () => {
    const { customers, loyalty, card } = await setup();
    const deps = { customers, loyalty };
    const first = await joinPublicCard(deps, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      card,
      data: { name: "Luis", email: "luis@example.com", mobile: "" },
    });
    const second = await joinPublicCard(deps, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      card,
      data: { name: "Luis", email: "luis@example.com", mobile: "" },
    });
    expect(first.createdCustomer).toBe(true);
    expect(second.createdCard).toBe(false);
    expect(second.issuedCard.id).toBe(first.issuedCard.id);
  });

  it("applies the contact policy configured on the card", async () => {
    const { customers, loyalty, card } = await setup();
    await expect(
      joinPublicCard({ customers, loyalty }, {
        organizationId: DEFAULT_ORGANIZATION_ID,
        card,
        data: { name: "Sin contacto", email: "", mobile: "" },
      }),
    ).rejects.toBeInstanceOf(CustomerContactRequiredError);
  });
});

describe("issued card service helpers", () => {
  it("issues, stamps, redeems and revokes through the service layer", async () => {
    const { customers, loyalty, card, customer } = await setup();
    const deps = { customers, loyalty };
    const issued = await issueCardForCustomer(deps, {
      organizationId: DEFAULT_ORGANIZATION_ID,
      card,
      customer,
      actor: { name: "Owner", role: "owner" },
    });
    const actor = { name: "Owner", role: "owner" as const };
    await addStampForIssuedCard(deps, { organizationId: DEFAULT_ORGANIZATION_ID, card, issuedCardId: issued.issuedCard.id, actor });
    await addStampForIssuedCard(deps, { organizationId: DEFAULT_ORGANIZATION_ID, card, issuedCardId: issued.issuedCard.id, actor });
    await addStampForIssuedCard(deps, { organizationId: DEFAULT_ORGANIZATION_ID, card, issuedCardId: issued.issuedCard.id, actor });
    expect((await redeemIssuedCard(deps, { organizationId: DEFAULT_ORGANIZATION_ID, card, issuedCardId: issued.issuedCard.id, actor })).status).toBe("redeemed");
    expect((await revokeIssuedCard(deps, { organizationId: DEFAULT_ORGANIZATION_ID, card, issuedCardId: issued.issuedCard.id, actor })).status).toBe("revoked");
  });
});
