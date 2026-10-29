import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { requireLoyaltyOperator } from "@/server/auth";
import { revokeIssuedCardAction } from "@/server/loyalty-actions";
import { issuedCardUrl } from "@/lib/cards/links";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Tarjetas emitidas" };

const statusLabel: Record<string, string> = { active: "Activa", redeemed: "Canjeada", revoked: "Revocada" };

export default async function IssuedCardsPage({ searchParams }: PageProps<"/dashboard/issued-cards">) {
  const user = await requireLoyaltyOperator();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" && ["active", "redeemed", "revoked"].includes(params.status)
    ? params.status as "active" | "redeemed" | "revoked"
    : undefined;
  const cardId = typeof params.cardId === "string" ? params.cardId : undefined;
  const issued = typeof params.issued === "string" ? params.issued : null;
  const { config, loyalty } = await getServices();
  const rows = await loyalty.list(user.organizationId, { search: q, status, cardId, limit: 200 });
  const counts = await loyalty.countForOrganization(user.organizationId);
  const canRevoke = user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin;
  const revoked = params.revoked === "1";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Lealtad</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Tarjetas emitidas</h1>
        <p className="mt-2 text-sm text-muted">Consulta el progreso y abre el kiosk para registrar visitas.</p>
      </div>

      {issued && <p className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">Tarjeta emitida. Comparte el QR o el enlace público con el cliente.</p>}
      {revoked && <p className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">Tarjeta revocada. Se conserva el historial y el pase queda marcado.</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card"><span className="text-xs text-muted">Total</span><span className="text-2xl font-bold">{counts.total}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Activas</span><span className="text-2xl font-bold">{counts.active}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Canjeadas</span><span className="text-2xl font-bold">{counts.redeemed}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Revocadas</span><span className="text-2xl font-bold">{counts.revoked}</span></div>
      </section>

      <section className="panel space-y-4">
        <form className="flex flex-col gap-2 sm:flex-row">
          {cardId && <input type="hidden" name="cardId" value={cardId} />}
          <input name="q" defaultValue={q} className="input" placeholder="Buscar cliente, campaña o código" />
          <select name="status" defaultValue={status ?? ""} className="input sm:max-w-40">
            <option value="">Todos</option>
            <option value="active">Activas</option>
            <option value="redeemed">Canjeadas</option>
            <option value="revoked">Revocadas</option>
          </select>
          <button className="btn-secondary whitespace-nowrap">Filtrar</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-normal">Cliente</th>
                <th className="py-2 font-normal">Campaña</th>
                <th className="py-2 text-center font-normal">Sellos</th>
                <th className="py-2 text-center font-normal">Estado</th>
                <th className="py-2 text-right font-normal">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-muted">No hay tarjetas emitidas.</td></tr>
              ) : rows.map(({ issuedCard, card, customer }) => (
                <tr key={issuedCard.id} className="border-b border-border last:border-0">
                  <td className="py-3">
                    <Link href={`/dashboard/customers/${customer.id}`} className="font-medium hover:text-accent">{customer.name}</Link>
                    <p className="text-xs text-muted">{customer.email ?? customer.mobile ?? "Sin contacto"}</p>
                  </td>
                  <td className="py-3">{card.name}</td>
                  <td className="py-3 text-center tabular-nums">{issuedCard.stamps}/{card.stampsRequired}</td>
                  <td className="py-3 text-center"><span className="badge">{statusLabel[issuedCard.status]}</span></td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/dashboard/scan?card=${issuedCard.token}`} className="btn-secondary px-3 py-1.5 text-xs">Kiosk</Link>
                      <a href={issuedCardUrl(config.baseUrl, card.slug, issuedCard.token)} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
                        Público <Glyph path={UI_ICON_PATHS.external} size={12} />
                      </a>
                      {canRevoke && issuedCard.status !== "revoked" && (
                        <form action={revokeIssuedCardAction.bind(null, issuedCard.id)}>
                          <button className="btn-ghost px-3 py-1.5 text-xs text-danger">Revocar</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
