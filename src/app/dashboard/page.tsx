import Link from "next/link";
import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { IntegrationBanner } from "@/components/IntegrationBanner";
import { requireAdmin } from "@/server/auth";
import { syncAllGoogleAction, unarchiveCardAction } from "@/server/actions";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Tarjetas" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireAdmin();
  const { config, cards } = await getServices();
  const list = await cards.listWithStats(user.organizationId);
  const archivedCards = await cards.listArchived(user.organizationId);
  const { googleSynced, googleFailed, googleError, googleWarn, archived } = await searchParams;
  const subscribers = list.reduce((sum, card) => sum + card.appleSubscribers + card.googleSubscribers, 0);
  const apple = list.reduce((sum, card) => sum + card.appleSubscribers, 0);
  const google = list.reduce((sum, card) => sum + card.googleSubscribers, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Panel</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Tarjetas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Diseña tarjetas, compártelas y envía notificaciones a la pantalla de bloqueo de tus clientes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {config.google && (
            <form action={syncAllGoogleAction}>
              <button className="btn-secondary">
                <Glyph path={UI_ICON_PATHS.refresh} size={16} /> Sincronizar Google
              </button>
            </form>
          )}
          <Link href="/dashboard/cards/new" className="btn-primary">
            <Glyph path={UI_ICON_PATHS.plus} size={17} /> Nueva tarjeta
          </Link>
        </div>
      </header>

      <IntegrationBanner config={config} />
      {archived === "1" && (
        <p role="status" className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
          Campaña archivada. Las tarjetas emitidas y sus pases siguen funcionando.
        </p>
      )}
      {typeof googleSynced === "string" && (
        <p role="status" className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
          Google actualizado en {googleSynced} tarjeta(s){typeof googleFailed === "string" && googleFailed !== "0" ? `, ${googleFailed} con avisos` : ""}.
        </p>
      )}
      {googleError === "not-configured" && <p className="text-sm text-warning">Google Wallet no está configurado en este servidor.</p>}
      {typeof googleWarn === "string" && <p className="text-sm text-warning">{googleWarn}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <div className="stat-card">
          <span className="text-xs font-medium text-muted">Tarjetas</span>
          <span className="text-2xl font-bold tabular-nums">{list.length}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs font-medium text-muted">Suscriptores</span>
          <span className="text-2xl font-bold tabular-nums">{subscribers}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs font-medium text-muted">Apple Wallet</span>
          <span className="text-2xl font-bold tabular-nums">{apple}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs font-medium text-muted">Google Wallet</span>
          <span className="text-2xl font-bold tabular-nums">{google}</span>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Glyph path={UI_ICON_PATHS.cards} size={24} />
          </span>
          <p className="text-lg font-semibold">Aún no hay tarjetas</p>
          <p className="max-w-md text-sm text-muted">
            Una tarjeta es lo que las personas agregan a su cartera. Cuando la tienen, puedes enviarles notificaciones a la pantalla de bloqueo.
          </p>
          <Link href="/dashboard/cards/new" className="btn-primary mt-2">
            <Glyph path={UI_ICON_PATHS.plus} size={17} /> Crear tu primera tarjeta
          </Link>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Tus tarjetas">
          {list.map((card) => {
            const total = card.appleSubscribers + card.googleSubscribers;
            return (
              <article key={card.id} className="panel flex flex-col">
                <Link href={`/dashboard/cards/${card.id}`} className="group block">
                  <div className="mb-4 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${card.bgColor}, ${card.accentColor})` }} />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.organizationName}</p>
                  <h2 className="mt-1 text-lg font-bold tracking-tight group-hover:text-accent">{card.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge">{total} suscriptores</span>
                    <span className="badge">Apple {card.appleSubscribers}</span>
                    <span className="badge">Google {card.googleSubscribers}</span>
                  </div>
                </Link>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Link href={`/dashboard/cards/${card.id}`} className="btn-secondary px-3 py-1.5 text-xs">Editar</Link>
                  <Link href={`/dashboard/send/${card.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                    <Glyph path={UI_ICON_PATHS.send} size={14} /> Enviar
                  </Link>
                  <Link href={`/c/${card.slug}`} target="_blank" className="btn-ghost ml-auto px-3 py-1.5 text-xs">
                    Compartir <Glyph path={UI_ICON_PATHS.external} size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {archivedCards.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Archivadas</h2>
            <p className="text-sm text-muted">Sus tarjetas emitidas y pases siguen funcionando.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archivedCards.map((card) => (
              <article key={card.id} className="panel flex flex-col gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">{card.organizationName}</p>
                  <h3 className="font-bold">{card.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/cards/${card.id}`} className="btn-secondary px-3 py-1.5 text-xs">Ver</Link>
                  <form action={unarchiveCardAction.bind(null, card.id)}>
                    <button className="btn-ghost px-3 py-1.5 text-xs">Reactivar</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
