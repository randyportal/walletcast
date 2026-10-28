"use client";

import { useActionState, useState } from "react";
import { createUserAction, deleteUserAction, updateUserAction } from "@/server/actions";

export interface UserRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: "admin" | "marketing";
  enabled: boolean;
  lastLoginAt: string | null;
}

const roleLabel = (role: string) => (role === "admin" ? "Administrador" : "Marketing");

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
            <option value="admin">Administrador</option>
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

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <section className="panel space-y-4">
        <h2 className="text-lg font-semibold">Agregar usuario</h2>
        <CreateUserForm />
      </section>

      <section className="panel">
        <h2 className="mb-4 text-lg font-semibold">Usuarios</h2>
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-border p-4">
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
                      if (!confirm(`¿Eliminar a ${u.name}? Esta acción no se puede deshacer.`)) e.preventDefault();
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
