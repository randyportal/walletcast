import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireAdmin } from "@/server/auth";
import { UsersManager } from "@/components/UsersManager";

export const metadata: Metadata = { title: "Usuarios" };

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
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("es") : null,
  }));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Equipo</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted">
            Los administradores pueden hacer todo. Los usuarios de marketing solo pueden enviar notificaciones.
          </p>
        </div>
      </div>
      {error === "self" && <p className="mb-4 text-sm text-danger">No puedes eliminar tu propia cuenta.</p>}
      {error === "lastadmin" && <p className="mb-4 text-sm text-danger">No puedes quitar al último administrador activo.</p>}
      <UsersManager users={rows} currentUserId={current.id} />
    </>
  );
}
