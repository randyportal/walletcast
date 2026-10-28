import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { renderLinkIcon } from "@/lib/cards/images";
import { contrastRatio, type LinkIcon } from "@/lib/cards/design";
import { normalizeGoogleConfig } from "@/lib/cards/google";

/** Public 1:1 icon used by Google Wallet value-added modules. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/cards/[id]/link-icon/[key]">) {
  const { id, key } = await ctx.params;
  const { cards, assets } = await getServices();
  const card = await cards.findById(id);
  if (!card) return new Response("No encontrado", { status: 404 });

  let icon: LinkIcon = "link";
  let assetId: string | null = null;
  if (key === "website") {
    icon = "globe";
  } else if (key === "contact") {
    icon = "contact";
  } else if (key.startsWith("link:")) {
    const link = card.links.find((l) => l.id === key.slice(5));
    if (!link) return new Response("No encontrado", { status: 404 });
    icon = link.icon;
    assetId = link.iconAssetId ?? null;
  } else if (key.startsWith("module:")) {
    const valueModule = normalizeGoogleConfig(card.googleConfig).valueModules.find((m) => m.id === key.slice(7));
    if (!valueModule) return new Response("No encontrado", { status: 404 });
    icon = valueModule.icon;
    assetId = valueModule.imageKind === "asset" ? valueModule.assetId : null;
  } else {
    return new Response("No encontrado", { status: 404 });
  }

  if (assetId) {
    const asset = await assets.findById(assetId);
    if (asset && asset.cardId === card.id) {
      return new Response(new Uint8Array(asset.data), {
        headers: { "content-type": asset.mime, "cache-control": "public, max-age=86400, immutable" },
      });
    }
  }

  const bg = card.accentColor;
  const fg = contrastRatio(bg, "#000000") >= contrastRatio(bg, "#ffffff") ? "#000000" : "#ffffff";
  const png = await renderLinkIcon(icon, bg, fg);
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" },
  });
}
