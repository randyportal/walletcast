"use client";

import { useActionState } from "react";
import { acceptInvitationAsNewUserAction } from "@/server/actions";

function fieldError(errors: Record<string, string> | undefined, key: string) {
  return errors?.[key] ? <p className="mt-1 text-xs text-danger">{errors[key]}</p> : null;
}

export function InviteSignupForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAsNewUserAction.bind(null, token), {});
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">Crea tu cuenta con {email} para aceptar la invitación.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Nombre</span>
          <input name="name" className="input" required maxLength={60} />
          {fieldError(state.fieldErrors, "name")}
        </label>
        <label className="block">
          <span className="field-label">Usuario</span>
          <input name="username" className="input" required maxLength={32} autoComplete="username" />
          {fieldError(state.fieldErrors, "username")}
        </label>
      </div>
      <label className="block">
        <span className="field-label">Contraseña</span>
        <input name="password" type="password" className="input" minLength={8} autoComplete="new-password" required />
        <p className="field-hint">Mínimo 8 caracteres.</p>
        {fieldError(state.fieldErrors, "password")}
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta y aceptar"}
      </button>
    </form>
  );
}
