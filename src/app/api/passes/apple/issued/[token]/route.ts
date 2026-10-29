import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { createRateLimiter, clientIp } from "@/lib/http/rateLimit";
import { jsonError, readFields } from "@/lib/http/responses";
import { issueApplePass, IssueRequestSchema, PlatformDisabledError } from "@/lib/passes/issue";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Public: issue/reuse an Apple Wallet pass for one issued loyalty card. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/passes/apple/issued/[token]">) {
  const { token } = await ctx.params;
  if (!limiter.hit(clientIp(request.headers))) return jsonError(429, "Demasiadas solicitudes. Inténtalo de nuevo en un minuto.");
  const { config, cards, subscribers, loyalty, organizations } = await getServices();
  const row = await loyalty.findByToken(token);
  if (!row) return jsonError(404, "Tarjeta no encontrada");

  const parsed = IssueRequestSchema.safeParse(await readFields(request));
  if (!parsed.success) return jsonError(400, "Datos inválidos");

  try {
    const passData = await loyalty.getPassData(row.issuedCard.id);
    if (!passData) return jsonError(404, "Tarjeta no encontrada");
    const org = await organizations.findById(row.issuedCard.organizationId);
    const subscriber = await subscribers.ensureForIssuedCard({
      organizationId: row.issuedCard.organizationId,
      cardId: row.card.id,
      issuedCardId: row.issuedCard.id,
      platform: "apple",
      email: row.customer.email,
      source: parsed.data.src,
    });
    const pkpass = await issueApplePass(
      config,
      cards,
      subscribers,
      row.card,
      { email: row.customer.email, src: parsed.data.src },
      passData,
      subscriber,
      org?.timeZone ?? config.glowTimeZone,
    );
    return new Response(new Uint8Array(pkpass), {
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "content-disposition": `attachment; filename="${row.card.slug}.pkpass"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PlatformDisabledError) return jsonError(404, error.message);
    console.error("[walletcast] apple issued pass failed", error);
    return jsonError(500, "No se pudo crear el pase");
  }
}
