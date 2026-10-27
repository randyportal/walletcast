import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/testing/db";
import { verifyPassword } from "@/lib/auth/password";
import { createUserRepository, EmailTakenError, UsernameTakenError } from "./repository";
import { ensureBootstrapAdmin } from "./bootstrap";
import { UserCreateSchema, UserUpdateSchema } from "./validation";

describe("user validation", () => {
  it("normalises usernames and emails", () => {
    const parsed = UserCreateSchema.parse({ username: "RANDY_Admin", name: "Randy", email: "Randy@Example.com", role: "admin", password: "12345678" });
    expect(parsed.username).toBe("randy_admin");
    expect(parsed.email).toBe("randy@example.com");
  });

  it("rejects bad usernames and short passwords", () => {
    expect(UserCreateSchema.safeParse({ username: "a", name: "X", password: "12345678" }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ username: "valid", name: "X", password: "123" }).success).toBe(false);
  });

  it("defaults the role to marketing", () => {
    expect(UserCreateSchema.parse({ username: "mkt", name: "M", password: "12345678" }).role).toBe("marketing");
  });

  it("treats an empty update password as no change", () => {
    const parsed = UserUpdateSchema.parse({ username: "mkt", name: "M", role: "marketing", enabled: "on", password: "" });
    expect(parsed.password).toBeNull();
  });
});

describe("user repository", () => {
  it("creates, finds, updates and deletes users", async () => {
    const db = await createTestDb();
    const repo = createUserRepository(db);
    const created = await repo.create({ username: "admin", name: "Admin", email: "admin@x.com", role: "admin", password: "hunter22" });
    expect(created).not.toHaveProperty("passwordHash");
    expect(created.role).toBe("admin");

    const byName = await repo.findByIdentifier("ADMIN");
    expect(byName?.id).toBe(created.id);
    const byEmail = await repo.findByIdentifier("admin@x.com");
    expect(byEmail?.id).toBe(created.id);
    expect(await verifyPassword("hunter22", byEmail!.passwordHash)).toBe(true);

    const updated = await repo.update(created.id, { username: "admin2", name: "Admin", email: null, role: "marketing", enabled: false });
    expect(updated?.role).toBe("marketing");
    expect(updated?.enabled).toBe(false);

    await repo.setPassword(created.id, "new-password");
    expect(await verifyPassword("new-password", (await repo.findById(created.id))!.passwordHash)).toBe(true);

    await repo.touchLastLogin(created.id);
    expect((await repo.findById(created.id))?.lastLoginAt).toBeInstanceOf(Date);

    await repo.remove(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it("refuses duplicate usernames and emails", async () => {
    const db = await createTestDb();
    const repo = createUserRepository(db);
    await repo.create({ username: "admin", name: "A", email: "a@x.com", role: "admin", password: "12345678" });
    await expect(repo.create({ username: "admin", name: "B", email: "b@x.com", role: "marketing", password: "12345678" })).rejects.toBeInstanceOf(UsernameTakenError);
    await expect(repo.create({ username: "other", name: "B", email: "a@x.com", role: "marketing", password: "12345678" })).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("counts active admins", async () => {
    const db = await createTestDb();
    const repo = createUserRepository(db);
    expect(await repo.countActiveAdmins()).toBe(0);
    await repo.create({ username: "a1", name: "A", email: null, role: "admin", password: "12345678" });
    await repo.create({ username: "m1", name: "M", email: null, role: "marketing", password: "12345678" });
    expect(await repo.countActiveAdmins()).toBe(1);
  });
});

describe("bootstrap admin", () => {
  it("creates the admin on first login and is idempotent", async () => {
    const db = await createTestDb();
    await ensureBootstrapAdmin(db, { username: "admin", password: "change-me" });
    await ensureBootstrapAdmin(db, { username: "admin", password: "change-me" });
    const repo = createUserRepository(db);
    const admins = (await repo.list()).filter((u) => u.role === "admin");
    expect(admins).toHaveLength(1);
    const user = await repo.findByIdentifier("admin");
    expect(await verifyPassword("change-me", user!.passwordHash)).toBe(true);
  });

  it("promotes an existing user when no admin exists", async () => {
    const db = await createTestDb();
    const repo = createUserRepository(db);
    await repo.create({ username: "admin", name: "Old", email: null, role: "marketing", password: "old-password" });
    await ensureBootstrapAdmin(db, { username: "admin", password: "fresh-password" });
    const user = await repo.findByIdentifier("admin");
    expect(user?.role).toBe("admin");
    expect(await verifyPassword("fresh-password", user!.passwordHash)).toBe(true);
  });

  it("does nothing when an admin already exists", async () => {
    const db = await createTestDb();
    const repo = createUserRepository(db);
    await repo.create({ username: "boss", name: "Boss", email: null, role: "admin", password: "keep-me" });
    await ensureBootstrapAdmin(db, { username: "admin", password: "change-me" });
    const admins = (await repo.list()).filter((u) => u.role === "admin");
    expect(admins.map((u) => u.username)).toEqual(["boss"]);
  });
});
