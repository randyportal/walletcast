import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireAdmin } from "@/server/auth";
import { UsersManager } from "@/components/UsersManager";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage({ searchParams }: PageProps<"/dashboard/users">) {
  const current = await requireAdmin();
  const { config, organizations } = await getServices();
  const list = await organizations.listMembers(current.organizationId);
  const invitations = await organizations.listInvitations(current.organizationId);
  const { error } = await searchParams;

  const rows = list.map((u) => ({
    id: u.userId,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    enabled: u.enabled,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("es") : null,
  }));

  const invitationRows = invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toLocaleDateString("es"),
    expired: invitation.expired,
    url: `${config.baseUrl.replace(/\/$/, "")}/invite/${invitation.token}`,
  }));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Equipo</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted">
            Los propietarios y administradores gestionan la organización. Marketing envía campañas, Staff escanea y registra compras, y Viewer solo consulta.
          </p>
        </div>
      </div>
      {error === "self" && <p className="mb-4 text-sm text-danger">No puedes eliminar tu propia cuenta.</p>}
      {error === "lastadmin" && <p className="mb-4 text-sm text-danger">No puedes quitar al último propietario activo.</p>}
      <UsersManager users={rows} invitations={invitationRows} currentUserId={current.id} />
    </>
  );
}
