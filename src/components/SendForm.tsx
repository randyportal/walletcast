"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/server/actions";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  subscriberCount: number;
}

export function SendForm({ action, subscriberCount }: Props) {
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

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input
        name="title"
        className="input"
        placeholder="Título (por ejemplo, Oferta flash)"
        maxLength={40}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        name="body"
        className="input min-h-24"
        placeholder="Tu mensaje. Aparecerá en la pantalla de bloqueo."
        maxLength={300}
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{body.length}/300</span>
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
