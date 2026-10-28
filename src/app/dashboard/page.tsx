import Link from "next/link";
import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { IntegrationBanner } from "@/components/IntegrationBanner";
import { requireAdmin } from "@/server/auth";
import { syncAllGoogleAction } from "@/server/actions";

export const metadata: Metadata = { title: "Tarjetas" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  await requireAdmin();
  const { config, cards } = await getServices();
  const list = await cards.listWithStats();
  const { googleSynced, googleFailed, googleError, googleWarn } = await searchParams;
  return (
    <>
      <IntegrationBanner config={config} />
      {typeof googleSynced === "string" && (
        <p className="mb-4 text-sm text-success">Google actualizado en {googleSynced} tarjeta(s){typeof googleFailed === "string" && googleFailed !== "0" ? `, ${googleFailed} con avisos` : ""}.</p>
      )}
      {googleError === "not-configured" && <p className="mb-4 text-sm text-warning">Google Wallet no está configurado en este servidor.</p>}
      {typeof googleWarn === "string" && <p className="mb-4 text-sm text-warning">{googleWarn}</p>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Tarjetas</h1>
        <div className="flex items-center gap-2">
          {config.google && (
            <form action={syncAllGoogleAction}>
              <button className="btn-secondary">Sincronizar pases Google</button>
            </form>
          )}
          <Link href="/dashboard/cards/new" className="btn-primary">
            Nueva tarjeta
          </Link>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="panel py-16 text-center">
          <p className="text-lg font-medium">Aún no hay tarjetas</p>
          <p className="mt-1 text-sm text-muted">
            Una tarjeta es lo que las personas agregan a su cartera. Cuando la tienen, puedes enviarles notificaciones a la pantalla de bloqueo.
          </p>
          <Link href="/dashboard/cards/new" className="btn-primary mt-6">
            Crear tu primera tarjeta
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => (
            <div key={card.id} className="panel">
              <Link href={`/dashboard/cards/${card.id}`} className="block transition hover:text-accent">
                <div className="mb-4 h-2 rounded-full" style={{ background: card.bgColor }} />
                <p className="text-sm text-muted">{card.organizationName}</p>
                <p className="text-lg font-semibold">{card.name}</p>
                <p className="mt-3 text-sm text-muted">
                  {card.appleSubscribers + card.googleSubscribers} suscriptores · {card.appleSubscribers} Apple ·{" "}
                  {card.googleSubscribers} Google
                </p>
              </Link>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/dashboard/cards/${card.id}`} className="btn-secondary px-2 py-1 text-xs">Editar</Link>
                <Link href={`/dashboard/send/${card.id}`} className="btn-secondary px-2 py-1 text-xs">Enviar</Link>
                <Link href={`/c/${card.slug}`} target="_blank" className="btn-secondary px-2 py-1 text-xs">Compartir ↗</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
