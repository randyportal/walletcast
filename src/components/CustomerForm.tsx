"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/actions";

type CustomerAction = (state: FormState, formData: FormData) => Promise<FormState>;

function fieldError(errors: Record<string, string> | undefined, key: string) {
  return errors?.[key] ? <p className="mt-1 text-xs text-danger">{errors[key]}</p> : null;
}

export function CustomerForm({
  action,
  initial,
  submitLabel,
}: {
  action: CustomerAction;
  initial?: { name?: string; email?: string | null; mobile?: string | null; status?: string };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Nombre</span>
          <input name="name" className="input" required maxLength={80} defaultValue={initial?.name ?? ""} />
          {fieldError(state.fieldErrors, "name")}
        </label>
        <label className="block">
          <span className="field-label">Estado</span>
          <select name="status" className="input" defaultValue={initial?.status ?? "active"}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Correo</span>
          <input name="email" type="email" className="input" defaultValue={initial?.email ?? ""} />
          {fieldError(state.fieldErrors, "email")}
        </label>
        <label className="block">
          <span className="field-label">Móvil</span>
          <input name="mobile" type="tel" className="input" defaultValue={initial?.mobile ?? ""} />
          {fieldError(state.fieldErrors, "mobile")}
        </label>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
