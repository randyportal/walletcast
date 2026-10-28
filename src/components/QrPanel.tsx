"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

/** Share link + QR code, with an optional placement tag (?src=) to track where people scanned. */
export function QrPanel({ cardId, baseLink }: { cardId: string; baseLink: string }) {
  const [source, setSource] = useState("");
  const clean = /^[\w-]{1,40}$/.test(source) ? source : "";
  const link = clean ? `${baseLink}?src=${clean}` : baseLink;
  const qs = clean ? `src=${clean}&` : "";
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="input font-mono text-xs" readOnly value={link} />
        <CopyButton text={link} />
      </div>
      <label className="block">
        <span className="field-label">Etiqueta de origen (opcional)</span>
        <input className="input" placeholder="por ejemplo: ventana, volante, recibo" value={source} onChange={(e) => setSource(e.target.value)} />
        <p className="field-hint">Letras, números y guiones. Te permite ver qué QR trae más personas.</p>
      </label>
      <div className="flex items-end gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/cards/${cardId}/qr?${qs}`} alt="Código QR" className="h-36 w-36 rounded-lg border border-border bg-white" />
        <div className="flex flex-col gap-2">
          <a className="btn-secondary" href={`/api/cards/${cardId}/qr?${qs}download`}>
            Descargar PNG
          </a>
          <a className="btn-secondary" href={`/api/cards/${cardId}/qr?${qs}format=svg&download`}>
            Descargar SVG
          </a>
        </div>
      </div>
    </div>
  );
}
