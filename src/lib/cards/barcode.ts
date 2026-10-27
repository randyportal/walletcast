import type { Card } from "@/lib/db/schema";
import { publicCardUrl } from "@/lib/cards/links";
import type { BarcodeType } from "./design";

export interface ResolvedBarcode {
  format: BarcodeType;
  value: string;
}

export const APPLE_BARCODE_FORMATS: Record<BarcodeType, string> = {
  qr: "PKBarcodeFormatQR",
  pdf417: "PKBarcodeFormatPDF417",
  aztec: "PKBarcodeFormatAztec",
  code128: "PKBarcodeFormatCode128",
};

export const GOOGLE_BARCODE_TYPES: Record<BarcodeType, string> = {
  qr: "QR_CODE",
  pdf417: "PDF_417",
  aztec: "AZTEC",
  code128: "CODE_128",
};

export function resolveBarcode(
  card: Pick<Card, "barcode" | "barcodeType" | "barcodeContent" | "barcodeValue" | "slug" | "websiteUrl">,
  baseUrl: string,
): ResolvedBarcode | null {
  if (!card.barcode) return null;
  let value: string | null = null;
  if (card.barcodeContent === "link") {
    value = publicCardUrl(baseUrl, card.slug, "pass");
  } else if (card.barcodeContent === "website") {
    value = card.websiteUrl ?? publicCardUrl(baseUrl, card.slug, "pass");
  } else {
    value = card.barcodeValue ?? null;
  }
  if (!value) return null;
  return { format: card.barcodeType as BarcodeType, value };
}
