import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config/env";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "@/lib/auth/session";
import { getServices } from "@/lib/services";
import type { OrganizationRole } from "@/lib/db/schema";

export interface CurrentUser extends SessionUser {
  email: string | null;
  organizationId: string;
  organizationRole: OrganizationRole;
  organizationName: string;
}

const ROLE_PRIORITY: Record<OrganizationRole, number> = {
  owner: 0,
  admin: 1,
  marketing: 2,
  staff: 3,
  viewer: 4,
};

async function loadCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token, getConfig().sessionSecret ?? null);
  if (!payload) return null;
  const { users, organizations } = await getServices();
  const user = await users.findById(payload.id);
  if (!user || !user.enabled) return null;
  const memberships = await organizations.listForUser(user.id);
  let selected: { id: string; name: string; role: OrganizationRole } | undefined =
    memberships.find((org) => org.id === payload.organizationId);
  if (!selected && user.isPlatformAdmin && payload.organizationId) {
    const org = await organizations.findById(payload.organizationId);
    if (org) selected = { id: org.id, name: org.name, role: "owner" };
  }
  selected ??= [...memberships].sort((a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role])[0];
  if (!selected) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: selected.id,
    organizationRole: selected.role,
    organizationName: selected.name,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return loadCurrentUser();
}

export async function isAdmin(): Promise<boolean> {
  const user = await loadCurrentUser();
  return Boolean(user && (user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin));
}

/** Call at the top of every server action and page open to any signed-in member. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Call at the top of every admin-only server action and page. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (!(user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin)) {
    redirect(user.organizationRole === "marketing" ? "/dashboard/send" : "/dashboard/scan");
  }
  return user;
}

export async function requireSender(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (!(user.organizationRole === "owner" || user.organizationRole === "admin" || user.organizationRole === "marketing" || user.isPlatformAdmin)) {
    redirect("/dashboard/scan");
  }
  return user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (!(user.organizationRole === "owner" || user.isPlatformAdmin)) redirect("/dashboard");
  return user;
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (!user.isPlatformAdmin) redirect("/dashboard");
  return user;
}

export function canManageCards(user: CurrentUser): boolean {
  return user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin;
}


export function canOperateLoyalty(user: CurrentUser): boolean {
  return (
    user.organizationRole === "owner" ||
    user.organizationRole === "admin" ||
    user.organizationRole === "staff" ||
    user.isPlatformAdmin
  );
}

export function canEditCustomers(user: CurrentUser): boolean {
  return user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin;
}

/** Call at the top of counter/loyalty operations: stamping, redeeming, issuing. */
export async function requireLoyaltyOperator(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (canOperateLoyalty(user)) return user;
  redirect(user.organizationRole === "marketing" ? "/dashboard/send" : "/dashboard/analytics");
}

/** Call at the top of customer create/edit screens. Staff may read customers but not edit them. */
export async function requireCustomerEditor(): Promise<CurrentUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (canEditCustomers(user)) return user;
  redirect("/dashboard/customers");
}
