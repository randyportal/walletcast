import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { renderCardIcon, renderCardHero, FAVICON_MASTER } from "@/lib/cards/images";
import { cardUsesHero } from "@/lib/cards/design";
import { glowSlot, slotHue } from "@/lib/glow/hue";

/**
 * Public card images. Google Wallet fetches `logo`, `icon` and `hero` by URL;
 * `favicon` and `background` serve the public page branding.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/cards/[id]/image/[kind]">) {
  const { id, kind } = await ctx.params;
  const allowed = new Set(["logo", "icon", "hero", "favicon", "background"]);
  if (!allowed.has(kind)) return new Response("Not found", { status: 404 });
  const { config, cards } = await getServices();
  const card = await cards.findById(id);
  if (!card) return new Response("Not found", { status: 404 });

  const headers = { "cache-control": "public, max-age=86400, immutable" };
  if (kind === "logo") {
    if (!card.logo) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(card.logo), { headers: { "content-type": "image/png", ...headers } });
  }
  if (kind === "icon") {
    const icon = await renderCardIcon(card);
    return new Response(new Uint8Array(icon), { headers: { "content-type": "image/png", ...headers } });
  }
  if (kind === "hero") {
    if (!cardUsesHero(card)) return new Response("Not found", { status: 404 });
    const hue = slotHue(glowSlot(new Date(), config.glowTimeZone));
    const hero = await renderCardHero(card, hue);
    if (!hero) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(hero), { headers: { "content-type": "image/png", ...headers } });
  }
  if (kind === "favicon") {
    const icon = card.favicon ?? (await renderCardIcon(card, FAVICON_MASTER.width));
    return new Response(new Uint8Array(icon), { headers: { "content-type": "image/png", ...headers } });
  }
  if (!card.backgroundImage) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(card.backgroundImage), {
    headers: { "content-type": "image/webp", ...headers },
  });
}
