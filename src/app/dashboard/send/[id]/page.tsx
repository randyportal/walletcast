import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServices } from "@/lib/services";
import { SendForm } from "@/components/SendForm";
import { sendMessageAction } from "@/server/actions";
import { requireUser } from "@/server/auth";
import { GOOGLE_DAILY_NOTIFICATION_LIMIT } from "@/lib/broadcast/broadcast";

export const metadata: Metadata = { title: "Enviar" };

export default async function SendCardPage({ params }: PageProps<"/dashboard/send/[id]">) {
  await requireUser();
  const { id } = await params;
  const { cards } = await getServices();
  const card = await cards.findById(id);
  if (!card) notFound();

  const stats = (await cards.listWithStats()).find((item) => item.id === id);
  const total = (stats?.appleSubscribers ?? 0) + (stats?.googleSubscribers ?? 0);
  const now = new Date();
  const googleToday = await cards.countMessagesSince(card.id, new Date(now.getTime() - 24 * 3600_000));
  const googleRemaining = Math.max(0, GOOGLE_DAILY_NOTIFICATION_LIMIT - googleToday);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-muted">{card.organizationName}</p>
        <h1 className="text-2xl font-semibold">{card.name}</h1>
      </div>

      <section className="panel">
        <h2 className="mb-1 text-lg font-semibold">Enviar una notificación</h2>
        <p className="mb-4 text-sm text-muted">
          Aparece en la pantalla de bloqueo de todos los que tienen la tarjeta y queda como el último mensaje.
        </p>
        <SendForm
          action={sendMessageAction.bind(null, card.id)}
          subscriberCount={total}
          organizationName={card.organizationName}
          cardName={card.name}
          iconUrl={`/api/cards/${card.id}/image/icon?v=${card.updatedAt.getTime()}`}
          googleRemaining={googleRemaining}
          lastMessage={card.latestMessage}
        />
      </section>

      <Link href="/dashboard/send" className="btn-secondary">
        ← Volver a tarjetas
      </Link>
    </div>
  );
}
