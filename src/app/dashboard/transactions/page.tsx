import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireLoyaltyOperator } from "@/server/auth";

export const metadata: Metadata = { title: "Movimientos" };

const labels: Record<string, string> = {
  issued: "Emitida", stamp_add: "Sello agregado", stamp_remove: "Sello eliminado", redeem: "Canjeada", revoke: "Revocada",
};

export default async function TransactionsPage({ searchParams }: PageProps<"/dashboard/transactions">) {
  const user = await requireLoyaltyOperator();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const typeParam = typeof params.type === "string" ? params.type : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const type = ["issued", "stamp_add", "stamp_remove", "redeem", "revoke"].includes(typeParam)
    ? typeParam as "issued" | "stamp_add" | "stamp_remove" | "redeem" | "revoke"
    : undefined;
  const { loyalty } = await getServices();
  const rows = await loyalty.listTransactions(user.organizationId, {
    search: q,
    type,
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999`) : undefined,
    limit: 300,
  });
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (typeParam) query.set("type", typeParam);
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Lealtad</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Movimientos</h1>
        <p className="mt-2 text-sm text-muted">Historial de altas, sellos, canjes y revocaciones.</p>
      </div>

      <section className="panel space-y-4">
        <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input name="q" defaultValue={q} className="input" placeholder="Cliente, campaña, código o nota" />
          <select name="type" defaultValue={typeParam} className="input sm:max-w-44">
            <option value="">Todos</option>
            <option value="issued">Emitidas</option>
            <option value="stamp_add">Sellos agregados</option>
            <option value="stamp_remove">Sellos removidos</option>
            <option value="redeem">Canjeadas</option>
            <option value="revoke">Revocadas</option>
          </select>
          <input name="from" type="date" defaultValue={from} className="input sm:max-w-40" aria-label="Desde" />
          <input name="to" type="date" defaultValue={to} className="input sm:max-w-40" aria-label="Hasta" />
          <button className="btn-secondary whitespace-nowrap">Filtrar</button>
        </form>
        <div className="flex justify-end">
          <a href={`/api/loyalty/transactions.csv?${query.toString()}`} className="btn-secondary">Exportar CSV</a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-normal">Fecha</th>
                <th className="py-2 font-normal">Cliente</th>
                <th className="py-2 font-normal">Campaña</th>
                <th className="py-2 font-normal">Acción</th>
                <th className="py-2 font-normal">Responsable</th>
                <th className="py-2 text-right font-normal">Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted">No hay movimientos.</td></tr>
              ) : rows.map(({ transaction, card, customer, issuedCard }) => (
                <tr key={transaction.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap py-3 text-muted">{transaction.createdAt.toLocaleString("es")}</td>
                  <td className="py-3">{customer.name}</td>
                  <td className="py-3">
                    <p>{card.name}</p>
                    <p className="font-mono text-[10px] text-muted">#{issuedCard.token.slice(0, 8)}</p>
                  </td>
                  <td className="py-3"><span className="badge">{labels[transaction.type] ?? transaction.type}</span></td>
                  <td className="py-3">
                    <p>{transaction.actorName ?? "Sistema"}</p>
                    <p className="text-xs capitalize text-muted">{transaction.actorRole ?? ""}</p>
                  </td>
                  <td className="max-w-52 truncate py-3 text-right text-muted">{transaction.remarks ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
