import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Analítica" };

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const user = await requireUser();
  const params = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const fromParam = typeof params.from === "string" && params.from ? params.from : dateInput(defaultFrom);
  const toParam = typeof params.to === "string" && params.to ? params.to : dateInput(today);
  const from = new Date(`${fromParam}T00:00:00`);
  const to = new Date(`${toParam}T23:59:59.999`);
  const { loyalty } = await getServices();
  const cards = await loyalty.list(user.organizationId, { limit: 10_000 });
  const transactions = await loyalty.listTransactions(user.organizationId, { from, to, limit: 10_000 });

  const active = cards.filter((row) => row.issuedCard.status === "active").length;
  const redeemed = cards.filter((row) => row.issuedCard.status === "redeemed").length;
  const revoked = cards.filter((row) => row.issuedCard.status === "revoked").length;
  const totalStamps = cards.reduce((sum, row) => sum + row.issuedCard.stamps, 0);
  const redemptionRate = cards.length > 0 ? Math.round((redeemed / cards.length) * 100) : 0;
  const stampAdds = transactions.filter((row) => row.transaction.type === "stamp_add").length;
  const redemptionEvents = transactions.filter((row) => row.transaction.type === "redeem").length;

  const byCard = new Map<string, { name: string; issued: number; active: number; redeemed: number; stamps: number }>();
  for (const row of cards) {
    const current = byCard.get(row.card.id) ?? { name: row.card.name, issued: 0, active: 0, redeemed: 0, stamps: 0 };
    current.issued += 1;
    current.stamps += row.issuedCard.stamps;
    if (row.issuedCard.status === "active") current.active += 1;
    if (row.issuedCard.status === "redeemed") current.redeemed += 1;
    byCard.set(row.card.id, current);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Lealtad</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Analítica</h1>
        <p className="mt-2 text-sm text-muted">Rendimiento de tarjetas, sellos y canjes.</p>
      </div>

      <form className="panel flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="field-label">Desde</span>
          <input name="from" type="date" defaultValue={fromParam} className="input" />
        </label>
        <label className="block">
          <span className="field-label">Hasta</span>
          <input name="to" type="date" defaultValue={toParam} className="input" />
        </label>
        <button className="btn-secondary">Aplicar</button>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card"><span className="text-xs text-muted">Tarjetas emitidas</span><span className="text-2xl font-bold">{cards.length}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Activas</span><span className="text-2xl font-bold">{active}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Canjeadas</span><span className="text-2xl font-bold">{redeemed}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Tasa de canje</span><span className="text-2xl font-bold">{redemptionRate}%</span></div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat-card"><span className="text-xs text-muted">Sellos acumulados</span><span className="text-2xl font-bold">{totalStamps}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Sellos en el periodo</span><span className="text-2xl font-bold">{stampAdds}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Canjes en el periodo</span><span className="text-2xl font-bold">{redemptionEvents}</span></div>
        <div className="stat-card"><span className="text-xs text-muted">Revocadas</span><span className="text-2xl font-bold">{revoked}</span></div>
      </section>

      <section className="panel">
        <h2 className="text-lg font-bold tracking-tight">Por campaña</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-normal">Campaña</th>
                <th className="py-2 text-center font-normal">Emitidas</th>
                <th className="py-2 text-center font-normal">Activas</th>
                <th className="py-2 text-center font-normal">Canjeadas</th>
                <th className="py-2 text-right font-normal">Sellos</th>
              </tr>
            </thead>
            <tbody>
              {byCard.size === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted">Aún no hay tarjetas emitidas.</td></tr>
              ) : [...byCard.values()].map((row) => (
                <tr key={row.name} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium">{row.name}</td>
                  <td className="py-3 text-center">{row.issued}</td>
                  <td className="py-3 text-center">{row.active}</td>
                  <td className="py-3 text-center">{row.redeemed}</td>
                  <td className="py-3 text-right tabular-nums">{row.stamps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
