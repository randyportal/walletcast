import type { Card, Subscriber } from "@/lib/db/schema";
import { latestMessageText } from "@/lib/apple/pass";
import { cardUsesHero } from "@/lib/cards/design";
import { GOOGLE_BARCODE_TYPES, resolveBarcode } from "@/lib/cards/barcode";
import {
  type HistoryMessage,
  historyText,
  normalizeContent,
  visibleRecommendations,
} from "@/lib/cards/content";
import {
  effectiveGoogleCodeMode,
  GOOGLE_TYPE_ENUM,
  normalizeGoogleConfig,
  type GoogleConfig,
} from "@/lib/cards/google";

/**
 * Mapping WalletCast cards/subscribers to Google Wallet Generic passes.
 * https://developers.google.com/wallet/generic/rest/v1/genericobject
 */

const localized = (value: string) => ({ defaultValue: { language: "es", value } });
type Localized = ReturnType<typeof localized>;
type ImageRef = { sourceUri: { uri: string }; contentDescription: Localized };

export interface GoogleObjectPatch {
  cardTitle: Localized;
  header: Localized;
  hexBackgroundColor: string;
  genericType?: string;
  logo: ImageRef;
  wideLogo?: ImageRef;
  heroImage?: ImageRef;
  barcode?: { type?: string; value?: string; alternateText?: string };
  appLinkData?: {
    displayText: Localized;
    webAppLinkInfo: { appTarget: { targetUri: { uri: string; description: string } } };
  };
  textModulesData: { id: string; header: string; body: string }[];
  linksModuleData?: { uris: { uri: string; description: string; id: string }[] };
  valueAddedModuleData?: Record<string, unknown>[];
  imageModulesData?: { id: string; mainImage: ImageRef }[];
}

/** Google ids: `${issuerId}.${suffix}` where suffix is [\w.-]+. */
export function classId(issuerId: string, card: Pick<Card, "id">): string {
  return `${issuerId}.wc_${card.id.replace(/-/g, "")}`;
}

export function objectId(issuerId: string, subscriber: Pick<Subscriber, "serialNumber">): string {
  return `${issuerId}.${subscriber.serialNumber.replace(/[^\w.-]/g, "_")}`;
}

export function imageUrl(
  baseUrl: string,
  card: Pick<Card, "id" | "updatedAt">,
  kind: "logo" | "icon" | "hero",
  size?: number,
): string {
  const sizeQuery = size ? `&size=${size}` : "";
  return `${baseUrl}/api/cards/${card.id}/image/${kind}?v=${card.updatedAt.getTime()}${sizeQuery}`;
}

export function assetUrl(baseUrl: string, card: Pick<Card, "id">, assetId: string): string {
  return `${baseUrl}/api/cards/${card.id}/asset/${assetId}`;
}

function linkIconUrl(baseUrl: string, card: Pick<Card, "id" | "updatedAt">, key: string): string {
  return `${baseUrl}/api/cards/${card.id}/link-icon/${encodeURIComponent(key)}?v=${card.updatedAt.getTime()}`;
}

function rowTemplate(fieldPath: string) {
  return {
    oneItem: {
      item: {
        firstValue: {
          fields: [{ fieldPath }],
        },
      },
    },
  };
}

export function buildGenericClass(issuerId: string, card: Card) {
  const config = normalizeGoogleConfig(card.googleConfig);
  const content = normalizeContent(card);
  const rows = [];
  if (content.config.latest.show) rows.push(rowTemplate("object.textModulesData['latest']"));
  if (config.showCustomFields) {
    for (const field of card.customFields.filter((f) => f.location === "front").slice(0, 2)) {
      rows.push(rowTemplate(`object.textModulesData['cf_${field.id}']`));
    }
  }
  return {
    id: classId(issuerId, card),
    ...(rows.length > 0
      ? {
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: rows,
            },
          },
        }
      : {}),
  };
}

export function buildGenericObject(
  issuerId: string,
  card: Card,
  subscriber: Subscriber,
  baseUrl: string,
  history: HistoryMessage[] = [],
) {
  return {
    id: objectId(issuerId, subscriber),
    classId: classId(issuerId, card),
    state: "ACTIVE",
    ...buildObjectPatch(card, baseUrl, history),
  };
}

function textModules(card: Card, config: GoogleConfig, history: HistoryMessage[]) {
  const content = normalizeContent(card);
  const modules: { id: string; header: string; body: string }[] = [];
  if (content.config.latest.show) {
    modules.push({ id: "latest", header: card.latestLabel || "Último mensaje", body: latestMessageText(card) });
  }
  if (content.config.latest.showHistory && history.length > 0) {
    modules.push({
      id: "history",
      header: content.config.latest.historyTitle,
      body: historyText(history, content.config.latest.historyLimit).slice(0, 500),
    });
  }
  if (config.showDescription && card.description) modules.push({ id: "about", header: "Acerca de", body: card.description });
  if (config.showCustomFields) {
    for (const field of card.customFields) {
      modules.push({ id: `cf_${field.id}`, header: field.label, body: field.value });
    }
  }
  for (const textModule of config.textModules) {
    modules.push({ id: `t_${textModule.id}`, header: textModule.header, body: textModule.body });
  }
  return modules.slice(0, 10);
}

function recommendationModules(card: Card, baseUrl: string) {
  const content = normalizeContent(card);
  if (!content.config.recommendations.show) return [];
  const modules: Record<string, unknown>[] = [];
  const links = visibleRecommendations(content.links);
  links.forEach((link, index) => {
    const imageUri = link.iconAssetId ? assetUrl(baseUrl, card, link.iconAssetId) : linkIconUrl(baseUrl, card, `link:${link.id}`);
    modules.push({
      header: localized(link.label),
      ...(link.subtitle ? { body: localized(link.subtitle) } : {}),
      uri: link.url,
      image: {
        sourceUri: { uri: imageUri },
        contentDescription: localized(link.label),
      },
      sortIndex: index,
    });
  });
  return modules.slice(0, 15);
}

/**
 * Everything that can change after the pass was saved. Used when a card design
 * changes; the caller PUTs this full object so removed fields are cleared.
 */
export function buildObjectPatch(card: Card, baseUrl: string, history: HistoryMessage[] = []): GoogleObjectPatch {
  const config = normalizeGoogleConfig(card.googleConfig);
  const hero = cardUsesHero(card);
  const mode = effectiveGoogleCodeMode(card);
  const barcodeCode = mode === "code" ? resolveBarcode(card, baseUrl) : null;
  const textCode = mode === "text" ? config.code.text : "";
  const modules = recommendationModules(card, baseUrl);
  const imageModule = config.imageModule?.assetId
    ? [
        {
          id: "image",
          mainImage: {
            sourceUri: { uri: assetUrl(baseUrl, card, config.imageModule.assetId) },
            contentDescription: localized(config.imageModule.description || card.name),
          },
        },
      ]
    : [];

  return {
    cardTitle: localized(card.organizationName),
    header: localized(card.name),
    hexBackgroundColor: card.bgColor,
    ...(config.type !== "auto" ? { genericType: GOOGLE_TYPE_ENUM[config.type] } : {}),
    logo: {
      sourceUri: { uri: imageUrl(baseUrl, card, "icon", 512) },
      contentDescription: localized(`${card.name} logo`),
    },
    ...(card.logo
      ? {
          wideLogo: {
            sourceUri: { uri: imageUrl(baseUrl, card, "logo") },
            contentDescription: localized(`${card.name} logo`),
          },
        }
      : {}),
    ...(hero
      ? {
          heroImage: {
            sourceUri: { uri: imageUrl(baseUrl, card, "hero") },
            contentDescription: localized(`${card.name} background`),
          },
        }
      : {}),
    ...(barcodeCode
      ? { barcode: { type: GOOGLE_BARCODE_TYPES[barcodeCode.format], value: barcodeCode.value } }
      : textCode
        ? { barcode: { alternateText: textCode } }
        : {}),
    ...(config.button
      ? {
          appLinkData: {
            displayText: localized(config.button.label),
            webAppLinkInfo: {
              appTarget: {
                targetUri: { uri: config.button.url, description: config.button.label },
              },
            },
          },
        }
      : {}),
    textModulesData: textModules(card, config, history),
    ...(modules.length > 0 ? { valueAddedModuleData: modules } : {}),
    // Clear the legacy links module so old passes stop showing the default globe icons.
    linksModuleData: { uris: [] },
    ...(imageModule.length > 0 ? { imageModulesData: imageModule } : {}),
  };
}

/** Minimal patch for broadcasts: only the modules whose text changes. */
export function buildMessagePatch(card: Card, history: HistoryMessage[] = []) {
  const config = normalizeGoogleConfig(card.googleConfig);
  return { textModulesData: textModules(card, config, history) };
}

export function buildNotifyMessage(title: string, body: string, id: string) {
  return {
    message: {
      id,
      header: title,
      body,
      messageType: "TEXT_AND_NOTIFY",
    },
  };
}
