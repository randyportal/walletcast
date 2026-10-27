import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config/env";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "@/lib/auth/session";
import { getServices } from "@/lib/services";

async function loadCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token, getConfig().sessionSecret ?? null);
  if (!payload) return null;
  const { users } = await getServices();
  const user = await users.findById(payload.id);
  if (!user || !user.enabled) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return loadCurrentUser();
}

export async function isAdmin(): Promise<boolean> {
  const user = await loadCurrentUser();
  return user?.role === "admin";
}

/** Call at the top of every server action and page open to both roles. */
export async function requireUser(): Promise<SessionUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Call at the top of every admin-only server action and page. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await loadCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/send");
  return user;
}
