"use client";

import { Glyph } from "./icons";

export interface NotificationPreviewProps {
  organizationName: string;
  cardName: string;
  iconUrl?: string | null;
  title: string;
  body: string;
}

function LockScreen({
  platform,
  organizationName,
  cardName,
  iconUrl,
  title,
  body,
}: NotificationPreviewProps & { platform: "apple" | "google" }) {
  const heading = platform === "apple" ? organizationName || cardName : title || "Título del mensaje";
  const text = platform === "apple" ? `${title}: ${body}` : body;
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-muted">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-black/10 dark:bg-white/10">
          <Glyph path="<rect width='18' height='14' x='3' y='5' rx='3'/><path d='M3 10h18'/>" size={12} />
        </span>
        {platform === "apple" ? "Apple Wallet" : "Google Wallet"}
        <span className="ml-auto">ahora</span>
      </div>
      <div className="flex gap-3">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
            {(cardName || organizationName || "W").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{heading || cardName || "Tarjeta"}</p>
          <p className="line-clamp-3 text-xs leading-snug text-foreground/85">{text || "Escribe un mensaje para ver la vista previa."}</p>
        </div>
      </div>
    </div>
  );
}

export function NotificationPreview(props: NotificationPreviewProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">Así se verá en la pantalla de bloqueo</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <LockScreen {...props} platform="apple" />
        <LockScreen {...props} platform="google" />
      </div>
      <p className="text-[11px] text-muted">El teléfono puede recortar el texto. El mensaje completo queda en la tarjeta.</p>
    </div>
  );
}
