import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { qrPng } from "@/lib/cards/links";
import { issuedCardUrl, staffScanUrl } from "@/lib/cards/links";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/issued-cards/[token]/qr">) {
  const { token } = await ctx.params;
  const { config, loyalty } = await getServices();
  const row = await loyalty.findByToken(token);
  if (!row) return new Response("No encontrado", { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind");
  const url = kind === "public"
    ? issuedCardUrl(config.baseUrl, row.card.slug, row.issuedCard.token)
    : staffScanUrl(config.baseUrl, row.issuedCard.token);
  const png = await qrPng(url, Number(new URL(request.url).searchParams.get("size") ?? 600));
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=300" },
  });
}
