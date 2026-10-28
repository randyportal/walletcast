import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServices } from "@/lib/services";
import { SendForm } from "@/components/SendForm";
import { sendMessageAction } from "@/server/actions";
import { requireSender } from "@/server/auth";
import { GOOGLE_DAILY_NOTIFICATION_LIMIT } from "@/lib/broadcast/broadcast";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Enviar" };

export default async function SendCardPage({ params }: PageProps<"/dashboard/send/[id]">) {
  const user = await requireSender();
  const { id } = await params;
  const { cards } = await getServices();
  const card = await cards.findById(user.organizationId, id);
  if (!card) notFound();

  const stats = (await cards.listWithStats(user.organizationId)).find((item) => item.id === id);
  const total = (stats?.appleSubscribers ?? 0) + (stats?.googleSubscribers ?? 0);
  const now = new Date();
  const googleToday = await cards.countMessagesSince(user.organizationId, card.id, new Date(now.getTime() - 24 * 3600_000));
  const googleRemaining = Math.max(0, GOOGLE_DAILY_NOTIFICATION_LIMIT - googleToday);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/send" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <Glyph path={UI_ICON_PATHS.chevronLeft} size={16} /> Volver a tarjetas
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{card.organizationName}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{card.name}</h1>
          <p className="mt-2 text-sm text-muted">Escribe el mensaje y revisa cómo se verá antes de enviarlo.</p>
        </div>
        <span className="badge">{total} cartera(s)</span>
      </div>

      <section className="panel">
        <h2 className="mb-1 text-xl font-bold tracking-tight">Enviar una notificación</h2>
        <p className="mb-5 text-sm text-muted">
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

    </div>
  );
}
