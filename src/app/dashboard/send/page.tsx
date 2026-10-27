import Link from "next/link";
import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Send" };

export default async function SendPage() {
  const user = await requireUser();
  const { cards } = await getServices();
  const list = await cards.listWithStats();
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Send a notification</h1>
          <p className="text-sm text-muted">Pick a card and write a message. It reaches every wallet instantly.</p>
        </div>
        {user.role === "admin" && (
          <Link href="/dashboard" className="btn-secondary">
            Manage cards
          </Link>
        )}
      </div>
      {list.length === 0 ? (
        <div className="panel py-16 text-center">
          <p className="text-lg font-medium">No cards yet</p>
          <p className="mt-1 text-sm text-muted">Ask an admin to create a card first.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => (
            <Link
              key={card.id}
              href={`/dashboard/send/${card.id}`}
              className="panel block transition hover:border-accent"
            >
              <div className="mb-4 h-2 rounded-full" style={{ background: card.bgColor }} />
              <p className="text-sm text-muted">{card.organizationName}</p>
              <p className="text-lg font-semibold">{card.name}</p>
              <p className="mt-3 text-sm text-muted">
                {card.appleSubscribers + card.googleSubscribers} subscriber
                {card.appleSubscribers + card.googleSubscribers === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
