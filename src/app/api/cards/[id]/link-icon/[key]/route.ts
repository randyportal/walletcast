import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { renderCustomLinkIcon, renderLinkIcon } from "@/lib/cards/images";
import { contrastRatio, type LinkIcon } from "@/lib/cards/design";
import { normalizeGoogleConfig } from "@/lib/cards/google";
import { normalizeContent } from "@/lib/cards/content";

/** Public 1:1 icon used by Google Wallet value-added modules. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/cards/[id]/link-icon/[key]">) {
  const { id, key } = await ctx.params;
  const { cards, assets } = await getServices();
  const card = await cards.findById(id);
  if (!card) return new Response("No encontrado", { status: 404 });
  const content = normalizeContent(card);
  const iconBackground = content.config.recommendations.iconBackground || card.accentColor;

  let icon: LinkIcon = "link";
  let assetId: string | null = null;
  if (key === "website") {
    icon = "globe";
  } else if (key === "contact") {
    icon = "contact";
  } else if (key.startsWith("link:")) {
    const link = normalizeContent(card).links.find((l) => l.id === key.slice(5));
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
      const png = await renderCustomLinkIcon(asset.data, iconBackground);
      return new Response(new Uint8Array(png), {
        headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" },
      });
    }
  }

  const fg = contrastRatio(iconBackground, "#000000") >= contrastRatio(iconBackground, "#ffffff") ? "#000000" : "#ffffff";
  const png = await renderLinkIcon(icon, iconBackground, fg);
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" },
  });
}
