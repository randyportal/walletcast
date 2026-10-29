import { describe, expect, it } from "vitest";
import { transactionsToCsv } from "./csv";
import type { TransactionRow } from "./repository";

describe("transactionsToCsv", () => {
  it("includes a BOM, headers and escaped values", () => {
    const row = {
      transaction: {
        id: "t1", organizationId: "o1", issuedCardId: "c1", type: "stamp_add", amount: 1,
        remarks: 'Dijo "hola"', actorUserId: null, actorName: "Ana", actorRole: "staff",
        createdAt: new Date("2026-10-28T12:00:00Z"),
      },
      issuedCard: { token: "11111111-1111-1111-1111-111111111111" },
      card: { name: "Café" },
      customer: { name: "Luis", email: "luis@example.com" },
    } as unknown as TransactionRow;
    const csv = transactionsToCsv([row]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Luis"');
    expect(csv).toContain('"Dijo ""hola"""');
    expect(csv).toContain('"Sello agregado"');
  });
});
