import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";

/** Public card asset (uploaded link icon, module image or image module). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/cards/[id]/asset/[assetId]">) {
  const { id, assetId } = await ctx.params;
  const { assets } = await getServices();
  const asset = await assets.findById(assetId);
  if (!asset || asset.cardId !== id) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: { "content-type": asset.mime, "cache-control": "public, max-age=86400, immutable" },
  });
}
