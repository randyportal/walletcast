"use client";

import { useActionState, useState } from "react";
import { createInvitationAction, createUserAction, deleteUserAction, revokeInvitationAction, updateUserAction } from "@/server/actions";

export type OrganizationRole = "owner" | "admin" | "marketing" | "staff" | "viewer";

export interface InvitationRow {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  expired: boolean;
  url: string;
}

export interface UserRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: OrganizationRole;
  enabled: boolean;
  lastLoginAt: string | null;
}

const roleLabel = (role: string) =>
  ({
    owner: "Propietario",
    admin: "Administrador",
    marketing: "Marketing",
    staff: "Staff",
    viewer: "Viewer",
  } as Record<string, string>)[role] ?? role;

function fieldError(fieldErrors: Record<string, string> | undefined, key: string) {
  return fieldErrors?.[key] ? <p className="mt-1 text-xs text-danger">{fieldErrors[key]}</p> : null;
}

function UserFields({
  errors,
  initial = {},
  showPassword,
}: {
  errors: Record<string, string> | undefined;
  initial?: Record<string, string>;
  showPassword?: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Nombre</span>
          <input name="name" className="input" required maxLength={60} defaultValue={initial.name} />
          {fieldError(errors, "name")}
        </label>
        <label className="block">
          <span className="field-label">Usuario</span>
          <input name="username" className="input" required maxLength={32} defaultValue={initial.username} />
          {fieldError(errors, "username")}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Correo (opcional)</span>
          <input name="email" type="email" className="input" defaultValue={initial.email} />
          {fieldError(errors, "email")}
        </label>
        <label className="block">
          <span className="field-label">Rol</span>
          <select name="role" className="input" defaultValue={initial.role ?? "marketing"}>
            <option value="marketing">Marketing</option>
            <option value="staff">Staff</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Administrador</option>
            <option value="owner">Propietario</option>
          </select>
        </label>
      </div>
      {showPassword && (
        <label className="block">
          <span className="field-label">Contraseña</span>
          <input name="password" type="password" className="input" minLength={8} autoComplete="new-password" />
          <p className="field-hint">Mínimo 8 caracteres.</p>
          {fieldError(errors, "password")}
        </label>
      )}
    </>
  );
}

export function UsersManager({
  users,
  invitations,
  currentUserId,
}: {
  users: UserRow[];
  invitations: InvitationRow[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <section className="panel space-y-4">
        <h2 className="text-lg font-semibold">Agregar usuario</h2>
        <CreateUserForm />
      </section>

      <section className="panel space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
          <p className="text-sm text-muted">Comparte el enlace con la persona invitada. Debe iniciar sesión con ese correo para aceptarla.</p>
        </div>
        <InviteForm />
        {invitations.length > 0 && (
          <div className="space-y-3">
            {invitations.map((invite) => (
              <div key={invite.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-xs text-muted">
                      {roleLabel(invite.role)} · {invite.expired ? "Expirada" : `Vence ${invite.expiresAt}`}
                    </p>
                  </div>
                  <a className="btn-secondary" href={invite.url} target="_blank" rel="noreferrer">
                    Abrir enlace
                  </a>
                  <form action={revokeInvitationAction.bind(null, invite.id)}>
                    <button type="submit" className="btn-danger">
                      Revocar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="mb-4 text-lg font-semibold">Usuarios</h2>
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {u.name} {u.id === currentUserId && <span className="text-xs text-muted">(tú)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    @{u.username}
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="badge">{roleLabel(u.role)}</span>
                    <span className={`badge ${u.enabled ? "text-success" : "text-warning"}`}>
                      {u.enabled ? "Activo" : "Deshabilitado"}
                    </span>
                    {u.lastLoginAt && <span>Último acceso {u.lastLoginAt}</span>}
                  </p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setEditing(editing === u.id ? null : u.id)}>
                  Edit
                </button>
                <form action={deleteUserAction.bind(null, u.id)}>
                  <button
                    type="submit"
                    className="btn-danger"
                    disabled={u.id === currentUserId}
                    onClick={(e) => {
                      if (!confirm(`¿Eliminar a ${u.name} de esta organización?`)) e.preventDefault();
                    }}
                  >
                    Delete
                  </button>
                </form>
              </div>
              {editing === u.id && <EditUserForm user={u} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InviteForm() {
  const [state, formAction, pending] = useActionState(createInvitationAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="field-label">Correo</span>
          <input name="email" type="email" className="input" required />
          {fieldError(state.fieldErrors, "email")}
        </label>
        <label className="block">
          <span className="field-label">Rol</span>
          <select name="role" className="input" defaultValue="staff">
            <option value="marketing">Marketing</option>
            <option value="staff">Staff</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Administrador</option>
            <option value="owner">Propietario</option>
          </select>
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      {state.inviteUrl && (
        <input
          className="input"
          readOnly
          value={state.inviteUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Enlace de invitación"
        />
      )}
    </form>
  );
}

function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, {});
  return (
    <form action={formAction} className="space-y-3">
      <UserFields errors={state.fieldErrors} showPassword />
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}

function EditUserForm({ user }: { user: UserRow }) {
  const [state, formAction, pending] = useActionState(updateUserAction.bind(null, user.id), {});
  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-border pt-4">
      <UserFields
        errors={state.fieldErrors}
        initial={{ name: user.name, username: user.username, email: user.email ?? "", role: user.role }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Nueva contraseña (opcional)</span>
          <input name="password" type="password" className="input" minLength={8} autoComplete="new-password" />
          <p className="field-hint">Déjala vacía para conservar la contraseña actual.</p>
          {fieldError(state.fieldErrors, "password")}
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={user.enabled} />
          Cuenta habilitada
        </label>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
