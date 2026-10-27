import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServices } from "@/lib/services";
import { SendForm } from "@/components/SendForm";
import { sendMessageAction } from "@/server/actions";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Send" };

export default async function SendCardPage({ params }: PageProps<"/dashboard/send/[id]">) {
  await requireUser();
  const { id } = await params;
  const { cards } = await getServices();
  const card = await cards.findById(id);
  if (!card) notFound();

  const [stats] = await cards.listWithStats();
  const total = stats.appleSubscribers + stats.googleSubscribers;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-muted">{card.organizationName}</p>
        <h1 className="text-2xl font-semibold">{card.name}</h1>
      </div>

      <section className="panel">
        <h2 className="mb-1 text-lg font-semibold">Send a notification</h2>
        <p className="mb-4 text-sm text-muted">
          Appears on the lock screen of everyone who has the card, and stays on the card as the latest message.
        </p>
        <SendForm action={sendMessageAction.bind(null, card.id)} subscriberCount={total} />
      </section>

      <Link href="/dashboard/send" className="btn-secondary">
        ← Back to cards
      </Link>
    </div>
  );
}
