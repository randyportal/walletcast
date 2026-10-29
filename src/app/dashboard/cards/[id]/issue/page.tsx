import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServices } from "@/lib/services";
import { requireLoyaltyOperator } from "@/server/auth";
import { IssueCardForm } from "@/components/IssueCardForm";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Emitir tarjeta" };

export default async function IssueCardPage({ params, searchParams }: PageProps<"/dashboard/cards/[id]/issue">) {
  const user = await requireLoyaltyOperator();
  const { id } = await params;
  const { customerId } = await searchParams;
  const { cards, customers } = await getServices();
  const card = await cards.findById(user.organizationId, id);
  if (!card) notFound();
  if (!card.loyaltyEnabled || card.archivedAt) redirect(`/dashboard/cards/${card.id}`);

  const list = await customers.list(user.organizationId, { status: "active", limit: 200 });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/dashboard/cards/${card.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <Glyph path={UI_ICON_PATHS.chevronLeft} size={16} /> {card.name}
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Lealtad</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Emitir tarjeta</h1>
        <p className="mt-2 text-sm text-muted">Asigna esta campaña a un cliente y comparte su tarjeta pública.</p>
      </div>
      <section className="panel">
        <IssueCardForm
          cardId={card.id}
          policy={card.joinContactPolicy}
          customers={list.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            mobile: customer.mobile,
          }))}
          defaultCustomerId={typeof customerId === "string" ? customerId : undefined}
        />
      </section>
    </div>
  );
}
