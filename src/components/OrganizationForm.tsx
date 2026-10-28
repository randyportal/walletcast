"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/server/actions";
import { ORGANIZATION_CURRENCIES } from "@/lib/organizations/validation";

export function OrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Nombre</span>
          <input name="name" className="input" required maxLength={80} placeholder="Café Central" />
          {state.fieldErrors?.name && <p className="mt-1 text-xs text-danger">{state.fieldErrors.name}</p>}
        </label>
        <label className="block">
          <span className="field-label">Identificador</span>
          <input name="slug" className="input" required maxLength={48} placeholder="cafe-central" />
          {state.fieldErrors?.slug && <p className="mt-1 text-xs text-danger">{state.fieldErrors.slug}</p>}
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Moneda</span>
          <select name="currency" className="input" defaultValue="MXN">
            {ORGANIZATION_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Zona horaria</span>
          <input name="timeZone" className="input" defaultValue="America/Mexico_City" />
        </label>
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Creando…" : "Crear organización"}</button>
    </form>
  );
}
