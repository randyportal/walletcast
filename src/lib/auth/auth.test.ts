import { describe, expect, it } from "vitest";
import { createSessionToken, SESSION_TTL_SECONDS, sessionCookieOptions, verifySessionToken, type SessionUser } from "./session";
import { clientIp, createRateLimiter } from "@/lib/http/rateLimit";

const secret = "s".repeat(32);
const user: SessionUser = {
  id: "user-1",
  username: "admin",
  name: "Admin",
  role: "admin",
  organizationId: "00000000-0000-0000-0000-000000000001",
  organizationRole: "owner",
  organizationName: "Travel Portal",
  isPlatformAdmin: true,
};

describe("admin session", () => {
  it("round-trips a session token with the user", async () => {
    const token = await createSessionToken(secret, user);
    expect(await verifySessionToken(token, secret)).toEqual({
      ...user,
      organizationRole: null,
      organizationName: null,
      isPlatformAdmin: false,
    });
    expect(await verifySessionToken(token, "o".repeat(32))).toBeNull();
    expect(await verifySessionToken(undefined, secret)).toBeNull();
    expect(await verifySessionToken("garbage", secret)).toBeNull();
    expect(await verifySessionToken(token, null)).toBeNull();
  });

  it("rejects tokens with an unknown role", async () => {
    const tampered = await new (await import("jose")).SignJWT({ role: "owner", username: "x", name: "X" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setAudience("walletcast-session")
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode(secret));
    expect(await verifySessionToken(tampered, secret)).toBeNull();
  });

  it("expires tokens", async () => {
    const old = await createSessionToken(secret, user, new Date(Date.now() - (SESSION_TTL_SECONDS + 60) * 1000));
    expect(await verifySessionToken(old, secret)).toBeNull();
  });

  it("builds secure cookie options", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect([rl.hit("a"), rl.hit("a"), rl.hit("a"), rl.hit("b")]).toEqual([true, true, false, true]);
    t = 1000;
    expect(rl.hit("a")).toBe(true);
  });

  it("reads the client ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
