import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireAdmin } from "@/server/auth";
import { UsersManager } from "@/components/UsersManager";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/dashboard/users">) {
  const current = await requireAdmin();
  const { users } = await getServices();
  const list = await users.list();
  const { error } = await searchParams;

  const rows = list.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    enabled: u.enabled,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : null,
  }));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted">
            Admins can do everything. Marketing users can only send notifications.
          </p>
        </div>
      </div>
      {error === "self" && <p className="mb-4 text-sm text-danger">You cannot delete your own account.</p>}
      {error === "lastadmin" && <p className="mb-4 text-sm text-danger">You cannot remove the last active admin.</p>}
      <UsersManager users={rows} currentUserId={current.id} />
    </>
  );
}
