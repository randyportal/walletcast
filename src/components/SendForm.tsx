"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/server/actions";
import { NotificationPreview } from "./NotificationPreview";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  subscriberCount: number;
  organizationName: string;
  cardName: string;
  iconUrl?: string | null;
  googleRemaining?: number;
  lastMessage?: string | null;
}

export function SendForm({ action, subscriberCount, organizationName, cardName, iconUrl, googleRemaining = 3, lastMessage }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await action(prev, data);
    if (result.success) {
      setTitle("");
      setBody("");
    }
    return result;
  }, {});

  const duplicate = Boolean(lastMessage && `${title}: ${body}` === lastMessage);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <NotificationPreview
        organizationName={organizationName}
        cardName={cardName}
        iconUrl={iconUrl}
        title={title}
        body={body}
      />
      <label className="block">
        <span className="field-label">Título</span>
        <input
          name="title"
          className="input"
          placeholder="Oferta flash"
          maxLength={40}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className="field-hint">{title.length}/40 · intenta que se lea completo en la notificación.</span>
      </label>
      <label className="block">
        <span className="field-label">Mensaje</span>
        <textarea
          name="body"
          className="input min-h-24"
          placeholder="Tu mensaje. Aparecerá en la pantalla de bloqueo."
          maxLength={300}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="field-hint">{body.length}/300 · los mensajes cortos se leen mejor sin abrir la tarjeta.</span>
      </label>
      {duplicate && <p className="text-xs text-warning">Es idéntico al último mensaje. Apple Wallet no mostrará otra notificación.</p>}
      {googleRemaining <= 0 && (
        <p className="text-xs text-warning">Google ya alcanzó las 3 notificaciones de hoy. El pase se actualizará, pero puede no mostrar aviso.</p>
      )}
      {googleRemaining > 0 && googleRemaining < 3 && (
        <p className="text-xs text-muted">Google: quedan {googleRemaining} notificaciones hoy.</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{subscriberCount} cartera(s)</span>
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || subscriberCount === 0}
          onClick={(e) => {
            if (!confirm(`¿Enviar esta notificación a ${subscriberCount} cartera(s)?`)) e.preventDefault();
          }}
        >
          {pending ? "Enviando…" : `Enviar a ${subscriberCount}`}
        </button>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      {state.warnings?.map((w) => (
        <p key={w} className="text-xs text-warning">
          {w}
        </p>
      ))}
    </form>
  );
}
