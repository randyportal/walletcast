import type { Db } from "@/lib/db/client";
import { createUserRepository } from "./repository";

export async function ensureBootstrapAdmin(
  db: Db,
  options: { username: string; password?: string },
): Promise<void> {
  if (!options.password) return;
  const repo = createUserRepository(db);
  const admins = (await repo.list()).filter((u) => u.role === "admin" && u.enabled);
  if (admins.length > 0) return;
  const existing = await repo.findByIdentifier(options.username);
  if (existing) {
    await repo.update(existing.id, {
      username: existing.username,
      name: existing.name,
      email: existing.email,
      role: "admin",
      enabled: true,
    });
    await repo.setPassword(existing.id, options.password);
  } else {
    await repo.create({
      username: options.username,
      name: "Administrator",
      email: null,
      role: "admin",
      password: options.password,
    });
  }
}
