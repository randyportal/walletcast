import { PKPass } from "passkit-generator";
import type { AppleConfig } from "@/lib/config/env";
import type { Card, Subscriber } from "@/lib/db/schema";
import { LOGO_MASTER, renderCardIcon, renderCardStrips, renderImageStrips, resizePng } from "@/lib/cards/images";
import { cardUsesHero } from "@/lib/cards/design";
import { APPLE_BARCODE_FORMATS, resolveBarcode } from "@/lib/cards/barcode";
import { glowSlot, slotHue } from "@/lib/glow/hue";
import { normalizeAppleConfig } from "@/lib/cards/apple";
import { type HistoryMessage, historyText, normalizeContent, visibleRecommendations } from "@/lib/cards/content";
import { type LoyaltyPassData, loyaltySummary } from "@/lib/loyalty/wallet";
import { issuedCardUrl, staffScanUrl } from "@/lib/cards/links";

export const APPLE_WEB_SERVICE_PATH = "/api/apple";
export const LATEST_FIELD_KEY = "latest";

/** Text shown on the pass (and in the notification) for the latest broadcast. */
export function latestMessageText(card: Pick<Card, "latestMessage" | "welcomeText">): string {
  return card.latestMessage || card.welcomeText || "Aquí recibirás novedades.";
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
  /** Previous messages, newest first. The latest message is rendered separately. */
  history?: HistoryMessage[];
  /** Time zone whose hour picks the day-glow strip. */
  timeZone?: string;
  /** Customer loyalty state for issued cards. */
  loyalty?: LoyaltyPassData | null;
  now?: Date;
}

/** Build and sign a .pkpass for one subscriber. */
export async function buildApplePass({
  card,
  subscriber,
  apple,
  baseUrl,
  history = [],
  timeZone = "Europe/Rome",
  loyalty = null,
  now = new Date(),
}: BuildApplePassArgs): Promise<Buffer> {
  const appleConfig = normalizeAppleConfig(card.appleConfig);
  const content = normalizeContent(card);
  const recommendations = visibleRecommendations(content.links);
  const hero = cardUsesHero(card) || Boolean(card.appleImage);
  const style = hero || loyalty ? "storeCard" : "generic";
  const summary = loyalty ? loyaltySummary(loyalty, card.stampsRequired, card.rewardName, timeZone) : null;
  const barcode = loyalty
    ? { format: "qr" as const, value: staffScanUrl(baseUrl, loyalty.issuedCard.token) }
    : resolveBarcode(card, baseUrl);
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
              ...(appleConfig.codeText ? { altText: appleConfig.codeText } : {}),
            },
          ],
        }
      : {}),
  };
  const hue = slotHue(glowSlot(now, timeZone));
  const strips = card.appleImage
    ? await renderImageStrips(card.appleImage)
    : hero
      ? await renderCardStrips(card, hue)
      : {};

  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson)), ...(await imageBuffers(card)), ...strips },
    {
      wwdr: apple.wwdr,
      signerCert: apple.signerCert,
      signerKey: apple.signerKey,
      signerKeyPassphrase: apple.signerKeyPassphrase,
    },
  );

  if (summary) {
    pass.headerFields.push({
      key: "stamps",
      label: "SELLOS",
      value: `${summary.stamps}/${summary.totalStamps}`,
      changeMessage: "Sellos: %@",
    });
  } else if (card.headerValue) {
    pass.headerFields.push({ key: "header", label: card.headerLabel.toUpperCase(), value: card.headerValue });
  }
  pass.primaryFields.push({ key: "name", label: (card.nameLabel || card.organizationName).toUpperCase(), value: card.name });
  if (summary) {
    pass.secondaryFields.push({ key: "reward", label: "RECOMPENSA", value: summary.rewardName || "Lealtad" });
    pass.secondaryFields.push({ key: "loyalty_status", label: "ESTADO", value: summary.statusLabel });
    pass.auxiliaryFields.push({ key: "loyalty_customer", label: "CLIENTE", value: summary.customerName });
    pass.auxiliaryFields.push({ key: "loyalty_last_visit", label: "ÚLTIMA VISITA", value: summary.lastVisit });
  } else if (content.config.latest.show) {
    pass.secondaryFields.push({
      key: LATEST_FIELD_KEY,
      label: card.latestLabel,
      value: latestMessageText(card),
      changeMessage: "%@",
    });
  }
  if (appleConfig.showCustomFields) {
    for (const field of card.customFields.filter((f) => f.location === "front").slice(0, summary ? 2 : 4)) {
      pass.auxiliaryFields.push({ key: `cf_${field.id}`, label: field.label.toUpperCase(), value: field.value });
    }
  }

  const back = [
    summary && content.config.latest.show && {
      key: LATEST_FIELD_KEY,
      label: card.latestLabel || "Último mensaje",
      value: latestMessageText(card),
      changeMessage: "%@",
    },
    !summary && !content.config.latest.show && {
      key: LATEST_FIELD_KEY,
      label: card.latestLabel || "Último mensaje",
      value: latestMessageText(card),
      changeMessage: "%@",
    },
    content.config.latest.showHistory && history.length > 0 && {
      key: "history",
      label: content.config.latest.historyTitle,
      value: historyText(history, content.config.latest.historyLimit),
    },
    summary && {
      key: "loyalty_history",
      label: "Historial de lealtad",
      value: summary.history || "Sin movimientos todavía.",
    },
    summary && {
      key: "loyalty_link",
      label: "Mi tarjeta",
      value: issuedCardUrl(baseUrl, card.slug, loyalty!.issuedCard.token),
    },
    appleConfig.showDescription && card.description && { key: "about", label: "Acerca de", value: card.description },
    ...(content.config.recommendations.show
      ? recommendations.map((link) => ({
          key: `link_${link.id}`,
          label: link.subtitle ? `${link.label} - ${link.subtitle}` : link.label,
          value: link.url,
        }))
      : []),
    ...(appleConfig.showCustomFields
      ? card.customFields
          .filter((f) => f.location === "back")
          .map((field) => ({ key: `cf_${field.id}`, label: field.label, value: field.value }))
      : []),
    ...(appleConfig.button
      ? [{ key: "button", label: appleConfig.button.label, value: appleConfig.button.url }]
      : []),
    ...appleConfig.textModules.map((textModule) => ({ key: `tm_${textModule.id}`, label: textModule.header, value: textModule.body })),
  ].filter(Boolean) as { key: string; label: string; value: string }[];
  pass.backFields.push(...back);

  return pass.getAsBuffer();
}
