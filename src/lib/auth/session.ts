import { jwtVerify, SignJWT } from "jose";
import type { OrganizationRole } from "@/lib/db/schema";

export const SESSION_COOKIE = "wc_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 3600;
const AUDIENCE = "walletcast-session";

export type UserRole = "admin" | "marketing";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
  organizationRole: OrganizationRole | null;
  organizationName: string | null;
  isPlatformAdmin: boolean;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(secret: string, user: SessionUser, now = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({
    username: user.username,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

export async function verifySessionToken(token: string | undefined, secret: string | null): Promise<SessionUser | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience: AUDIENCE, algorithms: ["HS256"] });
    const role = payload.role === "admin" || payload.role === "marketing" ? payload.role : null;
    if (!payload.sub || !role) return null;
    return {
      id: payload.sub,
      username: typeof payload.username === "string" ? payload.username : "",
      name: typeof payload.name === "string" ? payload.name : "",
      role,
      organizationId: typeof payload.organizationId === "string" ? payload.organizationId : null,
      organizationRole: null,
      organizationName: null,
      isPlatformAdmin: false,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
