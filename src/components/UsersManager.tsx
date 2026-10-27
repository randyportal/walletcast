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

const roleLabel = (role: string) => (role === "admin" ? "Admin" : "Marketing");

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
          <span className="field-label">Name</span>
          <input name="name" className="input" required maxLength={60} defaultValue={initial.name} />
          {fieldError(errors, "name")}
        </label>
        <label className="block">
          <span className="field-label">Username</span>
          <input name="username" className="input" required maxLength={32} defaultValue={initial.username} />
          {fieldError(errors, "username")}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Email (optional)</span>
          <input name="email" type="email" className="input" defaultValue={initial.email} />
          {fieldError(errors, "email")}
        </label>
        <label className="block">
          <span className="field-label">Role</span>
          <select name="role" className="input" defaultValue={initial.role ?? "marketing"}>
            <option value="marketing">Marketing</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {showPassword && (
        <label className="block">
          <span className="field-label">Password</span>
          <input name="password" type="password" className="input" minLength={8} autoComplete="new-password" />
          <p className="field-hint">At least 8 characters.</p>
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
        <h2 className="text-lg font-semibold">Add user</h2>
        <CreateUserForm />
      </section>

      <section className="panel">
        <h2 className="mb-4 text-lg font-semibold">Users</h2>
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {u.name} {u.id === currentUserId && <span className="text-xs text-muted">(you)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    @{u.username}
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="badge">{roleLabel(u.role)}</span>
                    <span className={`badge ${u.enabled ? "text-success" : "text-warning"}`}>
                      {u.enabled ? "Active" : "Disabled"}
                    </span>
                    {u.lastLoginAt && <span>Last login {u.lastLoginAt}</span>}
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
                      if (!confirm(`Delete ${u.name}? This cannot be undone.`)) e.preventDefault();
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
        {pending ? "Creating…" : "Create user"}
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
          <span className="field-label">New password (optional)</span>
          <input name="password" type="password" className="input" minLength={8} autoComplete="new-password" />
          <p className="field-hint">Leave blank to keep the current password.</p>
          {fieldError(state.fieldErrors, "password")}
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={user.enabled} />
          Account enabled
        </label>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
