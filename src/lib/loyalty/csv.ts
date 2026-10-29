import type { TransactionRow } from "./repository";

function cell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function transactionsToCsv(rows: TransactionRow[]): string {
  const header = ["Fecha", "Cliente", "Correo", "Campaña", "Código", "Acción", "Cantidad", "Responsable", "Rol", "Nota"];
  const labels: Record<string, string> = {
    issued: "Emitida", stamp_add: "Sello agregado", stamp_remove: "Sello eliminado", redeem: "Canjeada", revoke: "Revocada",
  };
  return "\uFEFF" + [
    header.map(cell).join(","),
    ...rows.map(({ transaction, issuedCard, card, customer }) => [
      transaction.createdAt.toISOString(),
      customer.name,
      customer.email ?? "",
      card.name,
      issuedCard.token,
      labels[transaction.type] ?? transaction.type,
      transaction.amount,
      transaction.actorName ?? "",
      transaction.actorRole ?? "",
      transaction.remarks ?? "",
    ].map(cell).join(",")),
  ].join("\r\n");
}
