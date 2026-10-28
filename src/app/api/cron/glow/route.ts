import { getServices } from "@/lib/services";
import { isCronAuthorized, refreshGlow } from "@/lib/glow/refresh";

/** Called hourly by .github/workflows/glow.yml with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(request: Request) {
  const { config, cards, subscribers, apns } = await getServices();
  if (!config.cronSecret) return new Response("No encontrado", { status: 404 });
  if (!isCronAuthorized(request.headers.get("authorization"), config.cronSecret)) {
    return new Response("No autorizado", { status: 401 });
  }
  return Response.json(await refreshGlow({ cards, subscribers, apns, timeZone: config.glowTimeZone }));
}
