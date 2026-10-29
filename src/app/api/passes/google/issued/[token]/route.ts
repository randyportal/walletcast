import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { createRateLimiter, clientIp } from "@/lib/http/rateLimit";
import { jsonError, readFields } from "@/lib/http/responses";
import { issueGooglePass, IssueRequestSchema, PlatformDisabledError } from "@/lib/passes/issue";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Public: issue/reuse a Google Wallet pass for one issued loyalty card. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/passes/google/issued/[token]">) {
  const { token } = await ctx.params;
  if (!limiter.hit(clientIp(request.headers))) return jsonError(429, "Demasiadas solicitudes. Inténtalo de nuevo en un minuto.");
  const { config, cards, subscribers, googleApi, loyalty, organizations } = await getServices();
  if (!googleApi) return jsonError(404, "Google Wallet no está configurado");
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
      platform: "google",
      email: row.customer.email,
      source: parsed.data.src,
    });
    const url = await issueGooglePass(
      config,
      cards,
      subscribers,
      googleApi,
      row.card,
      { email: row.customer.email, src: parsed.data.src },
      passData,
      subscriber,
      org?.timeZone ?? config.glowTimeZone,
    );
    const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
    return wantsJson ? Response.json({ url }) : Response.redirect(url, 303);
  } catch (error) {
    if (error instanceof PlatformDisabledError) return jsonError(404, error.message);
    console.error("[walletcast] google issued pass failed", error);
    return jsonError(502, "No se pudo crear el pase de Google Wallet");
  }
}
