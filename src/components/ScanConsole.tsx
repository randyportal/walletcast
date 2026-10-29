"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "qr-scanner";
import { Glyph, UI_ICON_PATHS } from "./icons";
import { loyaltyEventAction } from "@/server/loyalty-actions";

QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";

export interface ScanCardData {
  issuedCard: {
    id: string;
    token: string;
    stamps: number;
    status: "active" | "redeemed" | "revoked";
    lastVisitAt: string;
  };
  card: {
    id: string;
    name: string;
    slug: string;
    rewardName: string;
    stampsRequired: number;
    accentColor: string;
    bgColor: string;
    fgColor: string;
  };
  customer: {
    id: string;
    name: string;
    email: string | null;
    mobile: string | null;
  };
  history: { id: string; type: string; remarks: string | null; actorName: string | null; createdAt: string }[];
}

const labels: Record<string, string> = {
  issued: "Tarjeta emitida",
  stamp_add: "Sello agregado",
  stamp_remove: "Sello eliminado",
  redeem: "Recompensa canjeada",
  revoke: "Tarjeta revocada",
};

function extractToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return trimmed.split("/").filter(Boolean).pop() ?? "";
  }
}

export function ScanConsole({
  initialCard,
  canRevoke,
}: {
  initialCard: ScanCardData | null;
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    if (!scanning) return;
    let active = true;
    const scanner = new QrScanner(
      videoRef.current!,
      (result) => {
        const token = extractToken(result.data);
        if (!token || !active) return;
        scanner.stop();
        setScanning(false);
        router.push(`/dashboard/scan?card=${encodeURIComponent(token)}`);
      },
      { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true },
    );
    scannerRef.current = scanner;
    scanner.start().catch(() => {
      setScanError("No se pudo acceder a la cámara. Revisa los permisos.");
      setScanning(false);
    });
    return () => {
      active = false;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [scanning, router]);

  function openManual() {
    const token = extractToken(manual);
    if (!token) {
      setScanError("Escribe o pega el código de la tarjeta.");
      return;
    }
    router.push(`/dashboard/scan?card=${encodeURIComponent(token)}`);
  }

  return (
    <div className="space-y-6">
      <section className="panel space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Escanear tarjeta</h1>
            <p className="mt-2 text-sm text-muted">Escanea el QR del cliente o pega el código de la tarjeta.</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setScanError("");
              setScanning((value) => !value);
            }}
          >
            <Glyph path={UI_ICON_PATHS.scan} size={16} /> {scanning ? "Cerrar cámara" : "Abrir cámara"}
          </button>
        </div>
        {scanning && (
          <div className="overflow-hidden rounded-2xl border border-border bg-black">
            <video ref={videoRef} className="h-64 w-full object-cover sm:h-80" />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input font-mono"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Código o link de la tarjeta"
          />
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={openManual}>
            Abrir tarjeta
          </button>
        </div>
        {scanError && <p className="text-sm text-danger">{scanError}</p>}
      </section>

      {initialCard ? <CardConsole data={initialCard} canRevoke={canRevoke} /> : (
        <section className="panel flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Glyph path={UI_ICON_PATHS.scan} size={24} />
          </span>
          <p className="text-lg font-semibold">Sin tarjeta seleccionada</p>
          <p className="max-w-sm text-sm text-muted">Escanea un QR o pega el código para abrir la tarjeta del cliente.</p>
        </section>
      )}
    </div>
  );
}

function CardConsole({ data, canRevoke }: { data: ScanCardData; canRevoke: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(loyaltyEventAction.bind(null, data.issuedCard.id), {});
  const active = data.issuedCard.status === "active";
  const canAdd = active && data.issuedCard.stamps < data.card.stampsRequired;
  const canRemove = active && data.issuedCard.stamps > 0;
  const canRedeem = active && data.issuedCard.stamps >= data.card.stampsRequired;

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <>
      <section className="panel space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{data.card.name}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{data.customer.name}</h2>
            <p className="text-sm text-muted">{data.customer.email ?? data.customer.mobile ?? "Sin contacto"}</p>
          </div>
          <span className="badge">{data.issuedCard.status === "active" ? "Activa" : data.issuedCard.status === "redeemed" ? "Canjeada" : "Revocada"}</span>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Sellos</p>
            <p className="text-3xl font-bold tabular-nums">{data.issuedCard.stamps} / {data.card.stampsRequired}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Recompensa</p>
            <p className="max-w-[14rem] text-sm font-semibold">{data.card.rewardName || "Lealtad"}</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: data.card.stampsRequired }).map((_, index) => (
            <span
              key={index}
              className={`flex aspect-square items-center justify-center rounded-full border text-xs font-bold ${
                index < data.issuedCard.stamps ? "border-transparent" : "border-border bg-surface-2 text-muted"
              }`}
              style={index < data.issuedCard.stamps ? { background: data.card.accentColor, color: data.card.fgColor } : undefined}
            >
              {index < data.issuedCard.stamps ? <Glyph path={UI_ICON_PATHS.check} size={16} /> : index + 1}
            </span>
          ))}
        </div>

        <form action={action} className="space-y-3">
          <input name="remarks" className="input" placeholder="Nota opcional para el movimiento" maxLength={200} />
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          {state.success && <p className="text-sm text-success">{state.success}</p>}
          {state.warnings?.map((warning) => <p key={warning} className="text-sm text-warning">{warning}</p>)}
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="event" value="add" className="btn-primary" disabled={pending || !canAdd}>
              <Glyph path={UI_ICON_PATHS.plus} size={16} /> Agregar sello
            </button>
            <button type="submit" name="event" value="remove" className="btn-secondary" disabled={pending || !canRemove}>
              Quitar sello
            </button>
            <button type="submit" name="event" value="redeem" className="btn-secondary" disabled={pending || !canRedeem}>
              <Glyph path={UI_ICON_PATHS.star} size={16} /> Canjear
            </button>
            {canRevoke && (
              <button type="submit" name="event" value="revoke" className="btn-danger" disabled={pending || !active}>
                Revocar
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <a className="btn-secondary" href={`/c/${data.card.slug}/${data.issuedCard.token}`} target="_blank" rel="noreferrer">
            Ver tarjeta pública
          </a>
          <a className="btn-secondary" href={`/dashboard/cards/${data.card.id}/issue?customerId=${data.customer.id}`}>
            Emitir nueva tarjeta
          </a>
        </div>
      </section>

      <section className="panel">
        <h2 className="text-lg font-bold tracking-tight">Actividad reciente</h2>
        {data.history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin movimientos todavía.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.history.slice(0, 8).map((tx) => (
              <li key={tx.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{labels[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-muted">{tx.actorName ?? "Sistema"}{tx.remarks ? ` · ${tx.remarks}` : ""}</p>
                </div>
                <time className="shrink-0 text-xs text-muted">{new Date(tx.createdAt).toLocaleString("es")}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
