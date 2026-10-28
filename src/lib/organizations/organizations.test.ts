import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/testing/db";
import { createUserRepository } from "@/lib/users/repository";
import { createCardRepository } from "@/lib/cards/repository";
import { createSubscriberRepository } from "@/lib/subscribers/repository";
import { CardInputSchema } from "@/lib/cards/validation";
import {
  createOrganizationRepository,
  InvitationInvalidError,
  OrganizationSlugTakenError,
} from "./repository";
import { InvitationInputSchema, OrganizationInputSchema } from "./validation";

async function setup() {
  const db = await createTestDb();
  const users = createUserRepository(db);
  const organizations = createOrganizationRepository(db);
  const owner = await users.create({
    username: "owner",
    name: "Owner",
    email: "owner@example.com",
    role: "admin",
    password: "12345678",
  });
  const org = await organizations.createWithOwner({ name: "Café Central", slug: "cafe-central" }, owner.id);
  return { db, users, organizations, owner, org };
}

describe("organizations", () => {
  it("creates an organization with its owner and lists it for the user", async () => {
    const { organizations, owner, org } = await setup();
    const list = await organizations.listForUser(owner.id);
    expect(list.map((item) => item.id)).toContain(org.id);
    expect(list[0]?.role).toBe("owner");
    expect(await organizations.getMembership(owner.id, org.id)).toBe("owner");
    expect((await organizations.listMembers(org.id))[0]).toMatchObject({ userId: owner.id, role: "owner" });
  });

  it("rejects duplicate organization slugs", async () => {
    const { organizations, owner } = await setup();
    await expect(
      organizations.createWithOwner({ name: "Other", slug: "cafe-central" }, owner.id),
    ).rejects.toBeInstanceOf(OrganizationSlugTakenError);
  });

  it("accepts an invitation and adds membership", async () => {
    const { users, organizations, owner, org } = await setup();
    const guest = await users.create({
      username: "guest",
      name: "Guest",
      email: "guest@example.com",
      role: "marketing",
      password: "12345678",
    });
    const invite = await organizations.createInvitation({
      organizationId: org.id,
      email: "guest@example.com",
      role: "staff",
      invitedByUserId: owner.id,
    });
    const accepted = await organizations.acceptInvitation(invite.token, guest.id);
    expect(accepted.id).toBe(org.id);
    expect(await organizations.getMembership(guest.id, org.id)).toBe("staff");
    await expect(organizations.acceptInvitation(invite.token, guest.id)).rejects.toBeInstanceOf(InvitationInvalidError);
  });

  it("isolates cards and passes by organization", async () => {
    const { db, organizations, owner, org } = await setup();
    const second = await organizations.createWithOwner({ name: "Retail", slug: "retail" }, owner.id);
    const cards = createCardRepository(db);
    const subscribers = createSubscriberRepository(db);
    const cardA = await cards.create(
      org.id,
      CardInputSchema.parse({ name: "A", organizationName: "A", slug: "card-a" }),
    );
    const cardB = await cards.create(
      second.id,
      CardInputSchema.parse({ name: "B", organizationName: "B", slug: "card-b" }),
    );
    await subscribers.create({ organizationId: org.id, cardId: cardA.id, platform: "google" });

    expect(await cards.findById(org.id, cardA.id)).not.toBeNull();
    expect(await cards.findById(org.id, cardB.id)).toBeNull();
    expect((await cards.listWithStats(org.id)).map((card) => card.id)).toEqual([cardA.id]);
    expect(await subscribers.listActiveGoogle(org.id, cardA.id)).toHaveLength(1);
    expect(await subscribers.listActiveGoogle(second.id, cardA.id)).toHaveLength(0);
  });
});


describe("organization validation", () => {
  it("normalises organization input and rejects bad slugs or time zones", () => {
    expect(
      OrganizationInputSchema.parse({ name: "Café", slug: "CAFE-CENTRAL", currency: "USD", timeZone: "Europe/Madrid" }),
    ).toMatchObject({ slug: "cafe-central", currency: "USD" });
    expect(OrganizationInputSchema.safeParse({ name: "X", slug: "ok" }).success).toBe(false);
    expect(OrganizationInputSchema.safeParse({ name: "Café", slug: "Bad Slug" }).success).toBe(false);
    expect(OrganizationInputSchema.safeParse({ name: "Café", slug: "cafe", timeZone: "Mars/Base" }).success).toBe(false);
  });

  it("normalises invitation emails and defaults the role to staff", () => {
    expect(InvitationInputSchema.parse({ email: " Guest@Example.com " })).toEqual({
      email: "guest@example.com",
      role: "staff",
    });
    expect(InvitationInputSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(InvitationInputSchema.safeParse({ email: "a@b.co", role: "superadmin" }).success).toBe(false);
  });
});
