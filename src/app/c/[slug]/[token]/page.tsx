import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServices } from "@/lib/services";
import { PublicCardHero } from "@/components/PublicCardHero";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";
import { loyaltySummary } from "@/lib/loyalty/wallet";
import { contrastRatio, hexToRgba } from "@/lib/cards/design";

function accentText(hex: string): string {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#ffffff") ? "#000000" : "#ffffff";
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]/[token]">): Promise<Metadata> {
  const { token } = await params;
  const { loyalty } = await getServices();
  const row = await loyalty.findByToken(token);
  return {
    title: row ? `${row.card.name} · ${row.customer.name}` : "Tarjeta no encontrada",
    robots: { index: false, follow: false },
  };
}

const txLabel: Record<string, string> = {
  issued: "Tarjeta emitida",
  stamp_add: "Sello agregado",
  stamp_remove: "Sello eliminado",
  redeem: "Recompensa canjeada",
  revoke: "Tarjeta revocada",
};

export default async function IssuedCardPage({ params }: PageProps<"/c/[slug]/[token]">) {
  const { slug, token } = await params;
  const { config, loyalty, organizations } = await getServices();
  const row = await loyalty.findByToken(token);
  if (!row) notFound();
  if (row.card.slug !== slug) redirect(`/c/${row.card.slug}/${token}`);
  const passData = await loyalty.getPassData(row.issuedCard.id);
  if (!passData) notFound();
  const org = await organizations.findById(row.issuedCard.organizationId);
  const summary = loyaltySummary(passData, row.card.stampsRequired, row.card.rewardName, org?.timeZone ?? "America/Mexico_City");
  const isLocked = row.issuedCard.status !== "active";
  const canAddApple = Boolean(config.apple);
  const canAddGoogle = Boolean(config.google);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center overflow-hidden bg-background px-4 py-8 sm:py-12">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: `radial-gradient(72% 55% at 50% 0%, ${hexToRgba(row.card.accentColor, 0.2)}, transparent 68%)` }}
      />
      <div className="w-full max-w-md space-y-4">
        <PublicCardHero
          organizationName={row.card.organizationName}
          name={row.card.name}
          description={row.card.publicPageMode === "minimal" ? "" : row.card.description}
          welcomeText={row.card.publicPageMode === "minimal" ? "" : row.card.welcomeText}
          nameLabel={row.card.nameLabel}
          logoText={row.card.logoText}
          headerLabel={row.card.headerLabel}
          headerValue={row.card.headerValue}
          logoUrl={row.card.logo ? `/api/cards/${row.card.id}/image/logo` : null}
          iconUrl={`/api/cards/${row.card.id}/image/icon?v=${row.card.updatedAt.getTime()}`}
          bgColor={row.card.bgColor}
          fgColor={row.card.fgColor}
          labelColor={row.card.labelColor}
          accentColor={row.card.accentColor}
          backgroundType={row.card.backgroundType}
          bgColor2={row.card.bgColor2}
          gradientAngle={row.card.gradientAngle}
          backgroundOverlay={row.card.backgroundOverlay}
          backgroundOverlayColor={row.card.backgroundOverlayColor}
          backgroundPosition={row.card.backgroundPosition}
          backgroundImageUrl={row.card.backgroundImage ? `/api/cards/${row.card.id}/image/background?v=${row.card.updatedAt.getTime()}` : null}
          fontFamily={row.card.fontFamily}
          compact={row.card.publicPageMode === "minimal"}
        />

        <section className="panel space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Hola, {row.customer.name}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {isLocked ? summary.statusLabel : `${summary.stamps} de ${summary.totalStamps} sellos`}
              </p>
              <p className="text-sm text-muted">{row.card.rewardName || "Tu recompensa"}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Glyph path={UI_ICON_PATHS.star} size={20} />
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2" aria-label={`${summary.stamps} de ${summary.totalStamps} sellos`}>
            {Array.from({ length: summary.totalStamps }).map((_, index) => {
              const active = index < summary.stamps;
              return (
                <span
                  key={index}
                  className={`flex aspect-square items-center justify-center rounded-full border text-xs font-bold ${
                    active ? "border-transparent text-white" : "border-border bg-surface-2 text-muted"
                  }`}
                  style={active ? { background: row.card.accentColor, color: accentText(row.card.accentColor) } : undefined}
                >
                  {active ? <Glyph path={UI_ICON_PATHS.check} size={16} /> : index + 1}
                </span>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Última visita</p>
              <p className="mt-1 font-medium">{summary.lastVisit}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Estado</p>
              <p className="mt-1 font-medium">{summary.statusLabel}</p>
            </div>
          </div>

          {isLocked ? (
            <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
              Esta tarjeta ya está cerrada. Pide al negocio que te emita una nueva para seguir coleccionando.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Muestra este código al staff para registrar tu próxima visita.
            </p>
          )}

          {!isLocked && (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/issued-cards/${token}/qr?kind=scan&size=360`}
                alt="Código QR para el staff"
                className="h-52 w-52 rounded-2xl border border-border bg-white p-3"
              />
              <p className="font-mono text-[11px] text-muted">{token}</p>
            </div>
          )}

          {(canAddApple || canAddGoogle) && (
            <div className="space-y-2">
              <p className="text-center text-sm font-medium">Agrega tu tarjeta a Wallet</p>
              {canAddApple && (
                <form method="post" action={`/api/passes/apple/issued/${token}`}>
                  <input type="hidden" name="src" value="issued-card" />
                  <button className="min-h-12 w-full rounded-2xl px-4 py-3 text-base font-semibold shadow-sm" style={{ background: row.card.accentColor, color: accentText(row.card.accentColor) }}>
                    Agregar a Apple Wallet
                  </button>
                </form>
              )}
              {canAddGoogle && (
                <form method="post" action={`/api/passes/google/issued/${token}`}>
                  <input type="hidden" name="src" value="issued-card" />
                  <button className="min-h-12 w-full rounded-2xl border border-border px-4 py-3 text-base font-semibold">
                    Agregar a Google Wallet
                  </button>
                </form>
              )}
            </div>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-bold tracking-tight">Historial</h2>
          {passData.transactions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Todavía no hay movimientos.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {passData.transactions.slice().reverse().slice(0, 10).map((tx) => (
                <li key={tx.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{txLabel[tx.type] ?? tx.type}</p>
                  </div>
                  <time className="shrink-0 text-xs text-muted">
                    {new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone: org?.timeZone }).format(tx.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          {row.card.organizationName} · Travel Portal Wallet Card
        </footer>
      </div>
    </main>
  );
}
