import type { CardTransaction, Customer, IssuedCard } from "@/lib/db/schema";

export interface LoyaltyPassData {
  issuedCard: IssuedCard;
  customer: Customer;
  transactions: CardTransaction[];
}

const TYPE_LABELS: Record<CardTransaction["type"], string> = {
  issued: "Tarjeta emitida",
  stamp_add: "Sello agregado",
  stamp_remove: "Sello eliminado",
  redeem: "Recompensa canjeada",
  revoke: "Tarjeta revocada",
};

export interface LoyaltySummary {
  stamps: number;
  totalStamps: number;
  remaining: number;
  rewardName: string;
  customerName: string;
  lastVisit: string;
  statusLabel: string;
  history: string;
}

export function loyaltySummary(
  data: LoyaltyPassData,
  totalStamps: number,
  rewardName: string,
  timeZone: string,
): LoyaltySummary {
  const dateFmt = new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  const statusLabel =
    data.issuedCard.status === "redeemed"
      ? "Recompensa canjeada"
      : data.issuedCard.status === "revoked"
        ? "Tarjeta revocada"
        : "Tarjeta activa";
  const history = data.transactions
    .slice(-8)
    .reverse()
    .map((tx) => `${dateFmt.format(tx.createdAt)} - ${TYPE_LABELS[tx.type]}`)
    .join("\n");
  return {
    stamps: data.issuedCard.stamps,
    totalStamps,
    remaining: Math.max(0, totalStamps - data.issuedCard.stamps),
    rewardName,
    customerName: data.customer.name,
    lastVisit: dateFmt.format(data.issuedCard.lastVisitAt),
    statusLabel,
    history,
  };
}
