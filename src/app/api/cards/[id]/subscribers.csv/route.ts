import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { getCurrentUser } from "@/server/auth";
import { subscribersToCsv } from "@/lib/subscribers/csv";

/** Admin only: export subscribers (emails are only present if people gave one). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/cards/[id]/subscribers.csv">) {
  const user = await getCurrentUser();
  if (!user || !(user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin)) {
    return new Response("No autorizado", { status: 401 });
  }
  const { id } = await ctx.params;
  const { cards, subscribers } = await getServices();
  const card = await cards.findById(user.organizationId, id);
  if (!card) return new Response("No encontrado", { status: 404 });
  const rows = await subscribers.listForCard(user.organizationId, id, 100_000);
  return new Response(subscribersToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${card.slug}-subscribers.csv"`,
    },
  });
}
