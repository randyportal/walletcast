import { and, count, desc, eq, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { users, type User, type UserRole } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";

export type PublicUser = Omit<User, "passwordHash">;

export class UsernameTakenError extends Error {
  constructor() {
    super("This username is already taken");
    this.name = "UsernameTakenError";
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("This email is already used by another user");
    this.name = "EmailTakenError";
  }
}

function strip(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    enabled: user.enabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export interface NewUserInput {
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  password: string;
}

export interface UpdateUserInput {
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  enabled: boolean;
}

export function createUserRepository(db: Db) {
  async function assertAvailable(username: string, email: string | null, exceptId?: string): Promise<void> {
    const byName = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    if (byName.some((r) => r.id !== exceptId)) throw new UsernameTakenError();
    if (email) {
      const byEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (byEmail.some((r) => r.id !== exceptId)) throw new EmailTakenError();
    }
  }

  return {
    async create(input: NewUserInput): Promise<PublicUser> {
      await assertAvailable(input.username, input.email);
      const [row] = await db
        .insert(users)
        .values({
          username: input.username,
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash: await hashPassword(input.password),
        })
        .returning();
      return strip(row);
    },

    async findById(id: string): Promise<User | null> {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row ?? null;
    },

    async findByIdentifier(identifier: string): Promise<User | null> {
      const value = identifier.trim().toLowerCase();
      const [row] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, value), eq(users.email, value)))
        .limit(1);
      return row ?? null;
    },

    async list(): Promise<PublicUser[]> {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return rows.map(strip);
    },

    async update(id: string, input: UpdateUserInput): Promise<PublicUser | null> {
      await assertAvailable(input.username, input.email, id);
      const [row] = await db
        .update(users)
        .set({
          username: input.username,
          name: input.name,
          email: input.email,
          role: input.role,
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return row ? strip(row) : null;
    },

    async setPassword(id: string, password: string): Promise<void> {
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
        .where(eq(users.id, id));
    },

    async touchLastLogin(id: string): Promise<void> {
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
    },

    async remove(id: string): Promise<void> {
      await db.delete(users).where(eq(users.id, id));
    },

    async countActiveAdmins(): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.enabled, true)));
      return row?.n ?? 0;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
