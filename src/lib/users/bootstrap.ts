import type { Db } from "@/lib/db/client";
import { createUserRepository } from "./repository";
import { createOrganizationRepository } from "@/lib/organizations/repository";

export async function ensureBootstrapAdmin(
  db: Db,
  options: { username: string; password?: string },
): Promise<void> {
  if (!options.password) return;
  const repo = createUserRepository(db);
  const organizations = createOrganizationRepository(db);
  const org = await organizations.ensureDefaultOrganization();
  const existingAdmins = (await repo.list()).filter((u) => u.role === "admin" && u.enabled);
  if (existingAdmins.length > 0) {
    const admin = existingAdmins[0];
    await organizations.ensureMembership(admin.id, org.id, "owner");
    if (!admin.isPlatformAdmin) await repo.setPlatformAdmin(admin.id, true);
    return;
  }
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
    await repo.setPlatformAdmin(existing.id, true);
    await organizations.ensureMembership(existing.id, org.id, "owner");
  } else {
    const created = await repo.create({
      username: options.username,
      name: "Administrator",
      email: null,
      role: "admin",
      password: options.password,
      isPlatformAdmin: true,
    });
    await organizations.ensureMembership(created.id, org.id, "owner");
  }
}
