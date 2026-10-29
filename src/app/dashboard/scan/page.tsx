import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requireLoyaltyOperator } from "@/server/auth";
import { ScanConsole, type ScanCardData } from "@/components/ScanConsole";

export const metadata: Metadata = { title: "Escanear" };

export default async function ScanPage({ searchParams }: PageProps<"/dashboard/scan">) {
  const user = await requireLoyaltyOperator();
  const { card: token } = await searchParams;
  const { loyalty } = await getServices();
  const canRevoke = user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin;

  let data: ScanCardData | null = null;
  if (typeof token === "string" && token) {
    const row = await loyalty.findByToken(token, user.organizationId);
    if (row) {
      const passData = await loyalty.getPassData(row.issuedCard.id);
      if (passData) {
        data = {
          issuedCard: {
            id: row.issuedCard.id,
            token: row.issuedCard.token,
            stamps: row.issuedCard.stamps,
            status: row.issuedCard.status,
            lastVisitAt: row.issuedCard.lastVisitAt.toISOString(),
          },
          card: {
            id: row.card.id,
            name: row.card.name,
            slug: row.card.slug,
            rewardName: row.card.rewardName,
            stampsRequired: row.card.stampsRequired,
            accentColor: row.card.accentColor,
            bgColor: row.card.bgColor,
            fgColor: row.card.fgColor,
          },
          customer: {
            id: row.customer.id,
            name: row.customer.name,
            email: row.customer.email,
            mobile: row.customer.mobile,
          },
          history: passData.transactions.map((tx) => ({
            id: tx.id,
            type: tx.type,
            remarks: tx.remarks,
            actorName: tx.actorName,
            createdAt: tx.createdAt.toISOString(),
          })),
        };
      }
    }
  }

  return <ScanConsole initialCard={data} canRevoke={canRevoke} />;
}
