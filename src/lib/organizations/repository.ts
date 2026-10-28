import { randomBytes } from "node:crypto";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_ORGANIZATION_NAME, DEFAULT_ORGANIZATION_SLUG } from "./constants";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  invitations,
  organizationMemberships,
  organizations,
  users,
  type Organization,
  type OrganizationRole,
} from "@/lib/db/schema";

export class OrganizationSlugTakenError extends Error {
  constructor() {
    super("Este identificador de organización ya está ocupado");
    this.name = "OrganizationSlugTakenError";
  }
}

export class InvitationInvalidError extends Error {
  constructor() {
    super("La invitación no es válida o ya expiró");
    this.name = "InvitationInvalidError";
  }
}

export interface OrganizationWithRole extends Organization {
  role: OrganizationRole;
}

export interface MemberRow {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  role: OrganizationRole;
  enabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface NewOrganizationInput {
  name: string;
  slug: string;
  currency?: string;
  timeZone?: string;
  locale?: string;
}

function inviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export function createOrganizationRepository(db: Db) {
  return {
    async ensureDefaultOrganization(): Promise<Organization> {
      const existing = await db.select().from(organizations).where(eq(organizations.id, DEFAULT_ORGANIZATION_ID));
      if (existing[0]) return existing[0];
      await db
        .insert(organizations)
        .values({
          id: DEFAULT_ORGANIZATION_ID,
          name: DEFAULT_ORGANIZATION_NAME,
          slug: DEFAULT_ORGANIZATION_SLUG,
          currency: "MXN",
          timeZone: "America/Mexico_City",
          locale: "es",
        })
        .onConflictDoNothing();
      const [row] = await db.select().from(organizations).where(eq(organizations.id, DEFAULT_ORGANIZATION_ID));
      if (!row) throw new Error("No se pudo crear la organización por defecto");
      return row;
    },

    async createWithOwner(input: NewOrganizationInput, ownerUserId: string): Promise<Organization> {
      try {
        return await db.transaction(async (tx) => {
          const [org] = await tx
            .insert(organizations)
            .values({
              name: input.name,
              slug: input.slug,
              currency: input.currency ?? "MXN",
              timeZone: input.timeZone ?? "America/Mexico_City",
              locale: input.locale ?? "es",
            })
            .returning();
          await tx
            .insert(organizationMemberships)
            .values({ organizationId: org.id, userId: ownerUserId, role: "owner" })
            .onConflictDoNothing();
          return org;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new OrganizationSlugTakenError();
        throw error;
      }
    },

    async findById(id: string): Promise<Organization | null> {
      const [row] = await db.select().from(organizations).where(eq(organizations.id, id));
      return row ?? null;
    },

    async findBySlug(slug: string): Promise<Organization | null> {
      const [row] = await db.select().from(organizations).where(eq(organizations.slug, slug));
      return row ?? null;
    },

    async listAll(): Promise<Organization[]> {
      return db.select().from(organizations).orderBy(desc(organizations.createdAt));
    },

    async listForUser(userId: string): Promise<OrganizationWithRole[]> {
      const rows = await db
        .select({ organization: organizations, role: organizationMemberships.role })
        .from(organizationMemberships)
        .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
        .where(eq(organizationMemberships.userId, userId))
        .orderBy(desc(organizations.createdAt));
      return rows.map((row) => ({ ...row.organization, role: row.role }));
    },

    async getMembership(userId: string, organizationId: string): Promise<OrganizationRole | null> {
      const [row] = await db
        .select({ role: organizationMemberships.role })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.organizationId, organizationId),
          ),
        );
      return row?.role ?? null;
    },

    async ensureMembership(userId: string, organizationId: string, role: OrganizationRole): Promise<void> {
      await db
        .insert(organizationMemberships)
        .values({ organizationId, userId, role })
        .onConflictDoUpdate({
          target: [organizationMemberships.organizationId, organizationMemberships.userId],
          set: { role, updatedAt: new Date() },
        });
    },

    async listMembers(organizationId: string): Promise<MemberRow[]> {
      const rows = await db
        .select({
          userId: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          role: organizationMemberships.role,
          enabled: users.enabled,
          lastLoginAt: users.lastLoginAt,
          createdAt: organizationMemberships.createdAt,
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(users.id, organizationMemberships.userId))
        .where(eq(organizationMemberships.organizationId, organizationId))
        .orderBy(organizationMemberships.createdAt);
      return rows;
    },

    async updateMemberRole(organizationId: string, userId: string, role: OrganizationRole): Promise<void> {
      await db
        .update(organizationMemberships)
        .set({ role, updatedAt: new Date() })
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, userId),
          ),
        );
    },

    async removeMember(organizationId: string, userId: string): Promise<void> {
      await db
        .delete(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, userId),
          ),
        );
    },

    async countForUser(userId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(organizationMemberships)
        .where(eq(organizationMemberships.userId, userId));
      return row?.n ?? 0;
    },

    async countOwners(organizationId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(organizationMemberships)
        .innerJoin(users, eq(users.id, organizationMemberships.userId))
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.role, "owner"),
            eq(users.enabled, true),
          ),
        );
      return row?.n ?? 0;
    },

    async createInvitation(input: {
      organizationId: string;
      email: string;
      role: OrganizationRole;
      invitedByUserId: string;
      expiresInDays?: number;
    }) {
      const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 3600_000);
      const [row] = await db
        .insert(invitations)
        .values({
          organizationId: input.organizationId,
          email: input.email.toLowerCase(),
          role: input.role,
          invitedByUserId: input.invitedByUserId,
          token: inviteToken(),
          expiresAt,
        })
        .returning();
      return row;
    },

    async listInvitations(organizationId: string) {
      const rows = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.organizationId, organizationId), isNull(invitations.acceptedAt)))
        .orderBy(desc(invitations.createdAt));
      return rows.map((row) => ({ ...row, expired: row.expiresAt.getTime() < Date.now() }));
    },

    async findInvitation(token: string) {
      const [row] = await db.select().from(invitations).where(eq(invitations.token, token));
      return row ? { ...row, expired: row.expiresAt.getTime() < Date.now() } : null;
    },

    async acceptInvitation(token: string, userId: string): Promise<Organization> {
      return db.transaction(async (tx) => {
        const [invite] = await tx
          .select()
          .from(invitations)
          .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt)));
        if (!invite || invite.expiresAt.getTime() < Date.now()) throw new InvitationInvalidError();
        const [org] = await tx.select().from(organizations).where(eq(organizations.id, invite.organizationId));
        if (!org) throw new InvitationInvalidError();
        await tx
          .insert(organizationMemberships)
          .values({ organizationId: org.id, userId, role: invite.role })
          .onConflictDoUpdate({
            target: [organizationMemberships.organizationId, organizationMemberships.userId],
            set: { role: invite.role, updatedAt: new Date() },
          });
        await tx
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.id, invite.id));
        return org;
      });
    },

    async revokeInvitation(organizationId: string, id: string): Promise<void> {
      await db
        .delete(invitations)
        .where(and(eq(invitations.organizationId, organizationId), eq(invitations.id, id)));
    },

    async findPendingInvitationForEmail(organizationId: string, email: string) {
      const [row] = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, organizationId),
            eq(invitations.email, email.toLowerCase()),
            isNull(invitations.acceptedAt),
          ),
        )
        .orderBy(desc(invitations.createdAt));
      return row ?? null;
    },
  };
}

export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>;
