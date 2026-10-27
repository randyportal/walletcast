import { describe, expect, it } from "vitest";
import { generatePassword, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("hunter2", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("generates passwords", () => {
    const p = generatePassword(24);
    expect(p).toHaveLength(24);
    expect(generatePassword(24)).not.toBe(p);
  });
});
