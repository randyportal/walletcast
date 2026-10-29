import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { requireLoyaltyOperator, canEditCustomers } from "@/server/auth";
import { createCustomerAction } from "@/server/loyalty-actions";
import { CustomerForm } from "@/components/CustomerForm";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: PageProps<"/dashboard/customers">) {
  const user = await requireLoyaltyOperator();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : "";
  const { customers } = await getServices();
  const list = await customers.list(user.organizationId, { search, limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Lealtad</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="mt-2 text-sm text-muted">Directorio de clientes y tarjetas activas.</p>
      </div>

      {canEditCustomers(user) && (
        <section className="panel space-y-3">
          <h2 className="text-lg font-semibold">Agregar cliente</h2>
          <CustomerForm action={createCustomerAction} submitLabel="Crear cliente" />
        </section>
      )}

      <section className="panel space-y-4">
        <form className="flex gap-2">
          <input name="q" defaultValue={search} className="input" placeholder="Buscar por nombre, correo o móvil" />
          <button className="btn-secondary whitespace-nowrap">Buscar</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 font-normal">Cliente</th>
                <th className="py-2 font-normal">Contacto</th>
                <th className="py-2 text-center font-normal">Tarjetas activas</th>
                <th className="py-2 text-right font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted">No hay clientes.</td></tr>
              ) : list.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td className="py-3">
                    <Link href={`/dashboard/customers/${customer.id}`} className="font-medium hover:text-accent">{customer.name}</Link>
                  </td>
                  <td className="py-3 text-muted">
                    {customer.email ?? "—"}{customer.mobile ? ` · ${customer.mobile}` : ""}
                  </td>
                  <td className="py-3 text-center">{customer.activeCards}</td>
                  <td className="py-3 text-right">
                    <span className="badge">{customer.status === "active" ? "Activo" : "Inactivo"}</span>
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
