import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/testing/db";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organizations/constants";
import { createCardRepository } from "@/lib/cards/repository";
import { createLoyaltyRepository } from "@/lib/loyalty/repository";
import { createCustomerRepository, CustomerContactTakenError } from "./repository";
import { CardInputSchema } from "@/lib/cards/validation";
import { CustomerInputSchema, contactSatisfiesPolicy } from "./validation";

describe("customer repository", () => {
  it("creates, finds and deduplicates contacts inside an organization", async () => {
    const db = await createTestDb();
    const repo = createCustomerRepository(db);
    const customer = await repo.create(
      DEFAULT_ORGANIZATION_ID,
      CustomerInputSchema.parse({ name: "Ana", email: "ANA@Example.com", mobile: "55 1234 5678" }),
    );
    expect(customer.email).toBe("ana@example.com");
    expect(customer.mobile).toBe("5512345678");
    expect((await repo.findByIdentity(DEFAULT_ORGANIZATION_ID, { email: "ana@example.com", mobile: null }))[0].id).toBe(customer.id);
    await expect(
      repo.create(DEFAULT_ORGANIZATION_ID, CustomerInputSchema.parse({ name: "Otra", email: "ana@example.com" })),
    ).rejects.toBeInstanceOf(CustomerContactTakenError);
  });

  it("updates, finds, counts and filters customers", async () => {
    const db = await createTestDb();
    const repo = createCustomerRepository(db);
    const customer = await repo.create(DEFAULT_ORGANIZATION_ID, CustomerInputSchema.parse({ name: "Ana", email: "ana@example.com" }));
    const updated = await repo.update(
      DEFAULT_ORGANIZATION_ID,
      customer.id,
      CustomerInputSchema.parse({ name: "Ana María", email: "ana@example.com", mobile: "5512345678", status: "inactive" }),
    );
    expect(updated?.name).toBe("Ana María");
    expect((await repo.findById(DEFAULT_ORGANIZATION_ID, customer.id))?.status).toBe("inactive");
    expect(await repo.count(DEFAULT_ORGANIZATION_ID)).toBe(1);
    expect(await repo.list(DEFAULT_ORGANIZATION_ID, { status: "inactive" })).toHaveLength(1);
    expect(await repo.list(DEFAULT_ORGANIZATION_ID, { search: "María" })).toHaveLength(1);
    expect(await repo.update(DEFAULT_ORGANIZATION_ID, "00000000-0000-0000-0000-000000000099", CustomerInputSchema.parse({ name: "X" }))).toBeNull();
  });

  it("lists customers with active card counts", async () => {
    const db = await createTestDb();
    const customers = createCustomerRepository(db);
    const cards = createCardRepository(db);
    const loyalty = createLoyaltyRepository(db);
    const customer = await customers.create(DEFAULT_ORGANIZATION_ID, CustomerInputSchema.parse({ name: "Ana" }));
    const card = await cards.create(
      DEFAULT_ORGANIZATION_ID,
      CardInputSchema.parse({ name: "C", organizationName: "O", slug: "c", loyaltyEnabled: "on", rewardName: "Café", stampsRequired: 3 }),
    );
    await loyalty.create({ organizationId: DEFAULT_ORGANIZATION_ID, cardId: card.id, customerId: customer.id });
    const list = await customers.list(DEFAULT_ORGANIZATION_ID, { search: "Ana" });
    expect(list[0]).toMatchObject({ id: customer.id, activeCards: 1 });
  });
});

describe("contact policy", () => {
  it("supports optional, email, mobile and either contact", () => {
    expect(contactSatisfiesPolicy("optional", { email: null, mobile: null })).toBe(true);
    expect(contactSatisfiesPolicy("email", { email: null, mobile: "5512345678" })).toBe(false);
    expect(contactSatisfiesPolicy("mobile", { email: "a@b.co", mobile: null })).toBe(false);
    expect(contactSatisfiesPolicy("email_or_mobile", { email: null, mobile: "5512345678" })).toBe(true);
  });
});
