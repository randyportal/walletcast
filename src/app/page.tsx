import Link from "next/link";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export default function Home() {
  return (
    <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 overflow-hidden px-4 py-16 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_-10%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]" />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
          <Glyph path={UI_ICON_PATHS.wallet} size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Travel Portal Wallet Card</p>
          <p className="text-sm text-muted">Notificaciones sin app</p>
        </div>
      </div>
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">La tarjeta de tus clientes, en su pantalla de bloqueo.</h1>
        <p className="text-lg leading-relaxed text-muted">
          Crea una tarjeta para Apple Wallet o Google Wallet, compártela con un QR y envía mensajes que llegan como notificaciones. Sin app, sin cuenta y sin tienda de aplicaciones.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className="btn-primary">
          Abrir panel <Glyph path={UI_ICON_PATHS.external} size={16} />
        </Link>
        <a href="https://github.com/randyportal/walletcast" className="btn-secondary">
          Código fuente
        </a>
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <span className="badge">Apple Wallet</span>
        <span className="badge">Google Wallet</span>
        <span className="badge">Código abierto</span>
        <span className="badge">Autoalojado</span>
      </div>
    </main>
  );
}
