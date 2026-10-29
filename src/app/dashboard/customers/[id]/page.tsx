import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServices } from "@/lib/services";
import { canEditCustomers, requireLoyaltyOperator } from "@/server/auth";
import { updateCustomerAction } from "@/server/loyalty-actions";
import { CustomerForm } from "@/components/CustomerForm";
import { issuedCardUrl } from "@/lib/cards/links";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Cliente" };

const statusLabel: Record<string, string> = { active: "Activa", redeemed: "Canjeada", revoked: "Revocada" };
const txLabel: Record<string, string> = {
  issued: "Tarjeta emitida", stamp_add: "Sello agregado", stamp_remove: "Sello eliminado", redeem: "Recompensa canjeada", revoke: "Tarjeta revocada",
};

export default async function CustomerDetailPage({ params }: PageProps<"/dashboard/customers/[id]">) {
  const user = await requireLoyaltyOperator();
  const { id } = await params;
  const { config, customers, loyalty } = await getServices();
  const customer = await customers.findById(user.organizationId, id);
  if (!customer) notFound();
  const cards = await loyalty.listForCustomer(user.organizationId, customer.id);
  const issueCard = cards.find((row) => !row.card.archivedAt) ?? cards[0];
  const transactions = await loyalty.listTransactions(user.organizationId, { customerId: customer.id, limit: 100 });

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <Glyph path={UI_ICON_PATHS.chevronLeft} size={16} /> Clientes
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Cliente</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{customer.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {customer.email ?? "Sin correo"}{customer.mobile ? ` · ${customer.mobile}` : ""} · {customer.status === "active" ? "Activo" : "Inactivo"}
          </p>
        </div>
        {issueCard ? (
          <Link href={`/dashboard/cards/${issueCard.card.id}/issue?customerId=${customer.id}`} className="btn-primary">
            Emitir nueva tarjeta
          </Link>
        ) : (
          <Link href="/dashboard" className="btn-secondary">Elegir campaña</Link>
        )}
      </div>

      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold">Tarjetas</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">Este cliente aún no tiene tarjetas emitidas.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map(({ issuedCard, card }) => (
              <article key={issuedCard.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{card.name}</h3>
                    <p className="mt-1 text-sm text-muted">{issuedCard.stamps}/{card.stampsRequired} sellos · {statusLabel[issuedCard.status] ?? issuedCard.status}</p>
                  </div>
                  <span className="badge">{statusLabel[issuedCard.status] ?? issuedCard.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/dashboard/scan?card=${issuedCard.token}`} className="btn-secondary px-3 py-1.5 text-xs">Abrir kiosk</Link>
                  <a href={issuedCardUrl(config.baseUrl, card.slug, issuedCard.token)} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
                    Tarjeta pública <Glyph path={UI_ICON_PATHS.external} size={13} />
                  </a>
                  <Link href={`/dashboard/cards/${card.id}/issue?customerId=${customer.id}`} className="btn-ghost px-3 py-1.5 text-xs">Nueva</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {canEditCustomers(user) && (
        <section className="panel space-y-3">
          <h2 className="text-lg font-semibold">Editar cliente</h2>
          <CustomerForm
            action={updateCustomerAction.bind(null, customer.id)}
            submitLabel="Guardar cliente"
            initial={{ name: customer.name, email: customer.email, mobile: customer.mobile, status: customer.status }}
          />
        </section>
      )}

      <section className="panel">
        <h2 className="text-lg font-semibold">Movimientos</h2>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin movimientos.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {transactions.map(({ transaction, issuedCard, card }) => (
              <li key={transaction.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{txLabel[transaction.type] ?? transaction.type}</p>
                  <p className="text-xs text-muted">{card.name} · {issuedCard.stamps}/{card.stampsRequired} sellos{transaction.remarks ? ` · ${transaction.remarks}` : ""}</p>
                </div>
                <time className="shrink-0 text-xs text-muted">{transaction.createdAt.toLocaleString("es")}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
