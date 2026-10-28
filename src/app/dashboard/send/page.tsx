import Link from "next/link";
import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireSender } from "@/server/auth";

export const metadata: Metadata = { title: "Enviar" };

export default async function SendPage() {
  const user = await requireSender();
  const { cards } = await getServices();
  const list = await cards.listWithStats(user.organizationId);
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Campañas</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Enviar una notificación</h1>
          <p className="text-sm text-muted">Elige una tarjeta y escribe un mensaje. Llega a todas las carteras al instante.</p>
        </div>
        {user.role === "admin" && (
          <Link href="/dashboard" className="btn-secondary">
            Administrar tarjetas
          </Link>
        )}
      </div>
      {list.length === 0 ? (
        <div className="panel py-16 text-center">
          <p className="text-lg font-medium">Aún no hay tarjetas</p>
          <p className="mt-1 text-sm text-muted">Pide a un administrador que cree una tarjeta primero.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => (
            <Link
              key={card.id}
              href={`/dashboard/send/${card.id}`}
              className="panel block transition hover:border-accent hover:shadow-[var(--shadow-md)]"
            >
              <div className="mb-4 h-2 rounded-full" style={{ background: card.bgColor }} />
              <p className="text-sm text-muted">{card.organizationName}</p>
              <p className="text-lg font-semibold">{card.name}</p>
              <p className="mt-3 text-sm text-muted">
                {card.appleSubscribers + card.googleSubscribers} suscriptor
                {card.appleSubscribers + card.googleSubscribers === 1 ? "" : "es"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
