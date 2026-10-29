"use client";

import { useActionState } from "react";
import { publicJoinAction } from "@/server/loyalty-actions";
import type { JoinContactPolicy } from "@/lib/db/schema";

function fieldError(errors: Record<string, string> | undefined, key: string) {
  return errors?.[key] ? <p className="mt-1 text-xs text-danger">{errors[key]}</p> : null;
}

export function PublicJoinForm({
  slug,
  cardName,
  policy,
  joinEnabled = true,
}: {
  slug: string;
  cardName: string;
  policy: JoinContactPolicy;
  joinEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(publicJoinAction.bind(null, slug), {});
  const emailRequired = policy === "email";
  const mobileRequired = policy === "mobile";
  return (
    <form action={action} className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold tracking-tight">Obtén tu tarjeta de {cardName}</h2>
        <p className="mt-1 text-sm text-muted">Recibe sellos y consulta tu progreso desde tu teléfono.</p>
      </div>
      {!joinEnabled && (
        <p className="rounded-xl border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
          Las altas nuevas están pausadas. Si ya tienes una tarjeta, usa el mismo correo o móvil para recuperarla.
        </p>
      )}
      <label className="block">
        <span className="field-label">Nombre</span>
        <input name="name" className="input" required maxLength={80} autoComplete="name" />
        {fieldError(state.fieldErrors, "name")}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">
            Correo {policy === "email" ? "" : <span className="font-normal text-muted">(opcional)</span>}
          </span>
          <input name="email" type="email" className="input" required={emailRequired} autoComplete="email" />
          {fieldError(state.fieldErrors, "email")}
        </label>
        <label className="block">
          <span className="field-label">
            Móvil {policy === "mobile" ? "" : <span className="font-normal text-muted">(opcional)</span>}
          </span>
          <input name="mobile" type="tel" className="input" required={mobileRequired} autoComplete="tel" />
          {fieldError(state.fieldErrors, "mobile")}
        </label>
      </div>
      {policy === "email_or_mobile" && <p className="field-hint">Escribe al menos un correo o móvil para recuperar tu tarjeta.</p>}
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creando tarjeta…" : "Obtener mi tarjeta"}
      </button>
    </form>
  );
}
