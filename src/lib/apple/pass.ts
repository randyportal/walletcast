import { PKPass } from "passkit-generator";
import type { AppleConfig } from "@/lib/config/env";
import type { Card, Subscriber } from "@/lib/db/schema";
import { LOGO_MASTER, renderCardIcon, renderCardStrips, resizePng } from "@/lib/cards/images";
import { cardUsesHero } from "@/lib/cards/design";
import { APPLE_BARCODE_FORMATS, resolveBarcode } from "@/lib/cards/barcode";
import { glowSlot, slotHue } from "@/lib/glow/hue";

export const APPLE_WEB_SERVICE_PATH = "/api/apple";
export const LATEST_FIELD_KEY = "latest";

/** Text shown on the pass (and in the notification) for the latest broadcast. */
export function latestMessageText(card: Pick<Card, "latestMessage" | "welcomeText">): string {
  return card.latestMessage || card.welcomeText || "You will receive updates here.";
}

function hexToRgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function imageBuffers(card: Card): Promise<Record<string, Buffer>> {
  const icon = await renderCardIcon(card);
  const files: Record<string, Buffer> = {
    "icon.png": await resizePng(icon, 29, 29, "cover"),
    "icon@2x.png": await resizePng(icon, 58, 58, "cover"),
    "icon@3x.png": icon,
  };
  if (card.logo) {
    const { width, height } = LOGO_MASTER;
    files["logo.png"] = await resizePng(card.logo, width / 3, height / 3, "inside");
    files["logo@2x.png"] = await resizePng(card.logo, (width * 2) / 3, (height * 2) / 3, "inside");
    files["logo@3x.png"] = card.logo;
  }
  return files;
}

export interface BuildApplePassArgs {
  card: Card;
  subscriber: Pick<Subscriber, "serialNumber" | "authToken">;
  apple: AppleConfig;
  baseUrl: string;
  /** Time zone whose hour picks the day-glow strip. */
  timeZone?: string;
  now?: Date;
}

/** Build and sign a .pkpass for one subscriber. */
export async function buildApplePass({
  card,
  subscriber,
  apple,
  baseUrl,
  timeZone = "Europe/Rome",
  now = new Date(),
}: BuildApplePassArgs): Promise<Buffer> {
  const hero = cardUsesHero(card);
  const style = hero ? "storeCard" : "generic";
  const barcode = resolveBarcode(card, baseUrl);
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: apple.passTypeId,
    teamIdentifier: apple.teamId,
    serialNumber: subscriber.serialNumber,
    authenticationToken: subscriber.authToken,
    webServiceURL: `${baseUrl}${APPLE_WEB_SERVICE_PATH}`,
    organizationName: card.organizationName,
    description: card.name,
    logoText: card.logoText || (card.logo ? undefined : card.name),
    backgroundColor: hexToRgb(card.bgColor),
    foregroundColor: hexToRgb(card.fgColor),
    labelColor: hexToRgb(card.labelColor),
    sharingProhibited: false,
    [style]: {},
    ...(barcode
      ? {
          barcodes: [
            {
              format: APPLE_BARCODE_FORMATS[barcode.format],
              message: barcode.value,
              messageEncoding: "iso-8859-1",
            },
          ],
        }
      : {}),
  };
  const hue = slotHue(glowSlot(now, timeZone));
  const strips = hero ? await renderCardStrips(card, hue) : {};

  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson)), ...(await imageBuffers(card)), ...strips },
    {
      wwdr: apple.wwdr,
      signerCert: apple.signerCert,
      signerKey: apple.signerKey,
      signerKeyPassphrase: apple.signerKeyPassphrase,
    },
  );

  if (card.headerValue) {
    pass.headerFields.push({ key: "header", label: card.headerLabel.toUpperCase(), value: card.headerValue });
  }
  pass.primaryFields.push({ key: "name", label: (card.nameLabel || card.organizationName).toUpperCase(), value: card.name });
  pass.secondaryFields.push({
    key: LATEST_FIELD_KEY,
    label: card.latestLabel,
    value: latestMessageText(card),
    changeMessage: "%@",
  });
  for (const field of card.customFields.filter((f) => f.location === "front").slice(0, 4)) {
    pass.auxiliaryFields.push({ key: `cf_${field.id}`, label: field.label.toUpperCase(), value: field.value });
  }

  const back = [
    { key: "latest_back", label: "Latest message", value: latestMessageText(card) },
    card.description && { key: "about", label: "About", value: card.description },
    card.websiteUrl && { key: "website", label: "Website", value: card.websiteUrl },
    card.contactUrl && { key: "contact", label: "Save contact", value: card.contactUrl },
    ...card.links.map((link) => ({ key: `link_${link.id}`, label: link.label, value: link.url })),
    ...card.customFields
      .filter((f) => f.location === "back")
      .map((field) => ({ key: `cf_${field.id}`, label: field.label, value: field.value })),
  ].filter(Boolean) as { key: string; label: string; value: string }[];
  pass.backFields.push(...back);

  return pass.getAsBuffer();
}
