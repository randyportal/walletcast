import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Escanear" };

export default async function ScanPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{user.organizationName}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Escanear tarjeta</h1>
        <p className="mt-2 text-sm text-muted">El escáner de staff se habilitará con el módulo de lealtad.</p>
      </div>
      <section className="panel flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Glyph path={UI_ICON_PATHS.scan} size={24} />
        </span>
        <p className="text-lg font-semibold">Escáner en preparación</p>
        <p className="max-w-sm text-sm text-muted">Aquí podrás escanear el QR del cliente, registrar compras y canjear recompensas.</p>
      </section>
    </div>
  );
}
