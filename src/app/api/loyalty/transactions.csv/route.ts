import type { NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import { getCurrentUser, canOperateLoyalty } from "@/server/auth";
import { transactionsToCsv } from "@/lib/loyalty/csv";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canOperateLoyalty(user)) return new Response("No autorizado", { status: 401 });
  const { loyalty } = await getServices();
  const params = request.nextUrl.searchParams;
  const search = params.get("q") ?? undefined;
  const typeParam = params.get("type");
  const type = typeParam && ["issued", "stamp_add", "stamp_remove", "redeem", "revoke"].includes(typeParam)
    ? typeParam as "issued" | "stamp_add" | "stamp_remove" | "redeem" | "revoke"
    : undefined;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const rows = await loyalty.listTransactions(user.organizationId, {
    search,
    type,
    from: fromParam ? new Date(`${fromParam}T00:00:00`) : undefined,
    to: toParam ? new Date(`${toParam}T23:59:59.999`) : undefined,
    limit: 100_000,
  });
  return new Response(transactionsToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="movimientos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
