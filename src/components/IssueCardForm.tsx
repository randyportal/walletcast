"use client";

import { useActionState } from "react";
import { issueCardAction } from "@/server/loyalty-actions";
import type { JoinContactPolicy } from "@/lib/db/schema";

export interface IssueCustomerOption {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
}

export function IssueCardForm({
  cardId,
  policy,
  customers,
  defaultCustomerId,
}: {
  cardId: string;
  policy: JoinContactPolicy;
  customers: IssueCustomerOption[];
  defaultCustomerId?: string;
}) {
  const [state, action, pending] = useActionState(issueCardAction.bind(null, cardId), {});
  const emailRequired = policy === "email";
  const mobileRequired = policy === "mobile";
  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="field-label">Cliente existente</span>
        <select name="customerId" className="input" defaultValue={defaultCustomerId ?? ""}>
          <option value="">— Crear cliente nuevo —</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}{customer.email ? ` · ${customer.email}` : customer.mobile ? ` · ${customer.mobile}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <p className="text-sm font-semibold">O crea un cliente nuevo</p>
        <p className="mt-1 text-xs text-muted">
          {policy === "optional" && "Solo el nombre es obligatorio."}
          {policy === "email" && "El correo es obligatorio."}
          {policy === "mobile" && "El móvil es obligatorio."}
          {policy === "email_or_mobile" && "Escribe al menos un correo o móvil."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">Nombre</span>
            <input name="newName" className="input" maxLength={80} />
          </label>
          <label className="block">
            <span className="field-label">Correo</span>
            <input name="newEmail" type="email" className="input" required={emailRequired} />
          </label>
          <label className="block">
            <span className="field-label">Móvil</span>
            <input name="newMobile" type="tel" className="input" required={mobileRequired} />
          </label>
        </div>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Emitiendo…" : "Emitir tarjeta"}
      </button>
    </form>
  );
}
