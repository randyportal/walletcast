import type { Card, Subscriber } from "@/lib/db/schema";
import { latestMessageText } from "@/lib/apple/pass";
import { cardUsesHero } from "@/lib/cards/design";
import { GOOGLE_BARCODE_TYPES, resolveBarcode } from "@/lib/cards/barcode";
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

export function imageUrl(baseUrl: string, card: Pick<Card, "id" | "updatedAt">, kind: "logo" | "icon" | "hero"): string {
  return `${baseUrl}/api/cards/${card.id}/image/${kind}?v=${card.updatedAt.getTime()}`;
}

export function assetUrl(baseUrl: string, card: Pick<Card, "id">, assetId: string): string {
  return `${baseUrl}/api/cards/${card.id}/asset/${assetId}`;
}

function linkIconUrl(baseUrl: string, card: Pick<Card, "id" | "updatedAt">, key: string): string {
  return `${baseUrl}/api/cards/${card.id}/link-icon/${encodeURIComponent(key)}?v=${card.updatedAt.getTime()}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
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
  const rows = [];
  if (config.showLatest) rows.push(rowTemplate("object.textModulesData['latest']"));
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

export function buildGenericObject(issuerId: string, card: Card, subscriber: Subscriber, baseUrl: string) {
  return {
    id: objectId(issuerId, subscriber),
    classId: classId(issuerId, card),
    state: "ACTIVE",
    ...buildObjectPatch(card, baseUrl),
  };
}

function textModules(card: Card, config: GoogleConfig) {
  const modules: { id: string; header: string; body: string }[] = [];
  if (config.showLatest) modules.push({ id: "latest", header: "Último mensaje", body: latestMessageText(card) });
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

function valueModules(card: Card, config: GoogleConfig, baseUrl: string) {
  const modules: Record<string, unknown>[] = [];
  let index = 0;
  const push = (header: string, body: string, uri: string, key: string, assetId: string | null) => {
    const imageUri = assetId ? assetUrl(baseUrl, card, assetId) : linkIconUrl(baseUrl, card, key);
    modules.push({
      header: localized(header),
      ...(body ? { body: localized(body) } : {}),
      uri,
      image: {
        sourceUri: { uri: imageUri },
        contentDescription: localized(header),
      },
      sortIndex: index++,
    });
  };

  if (card.websiteUrl) push("Sitio web", hostOf(card.websiteUrl), card.websiteUrl, "website", null);
  if (card.contactUrl) push("Guardar contacto", hostOf(card.contactUrl), card.contactUrl, "contact", null);
  for (const link of card.links) {
    push(link.label, hostOf(link.url), link.url, `link:${link.id}`, link.iconAssetId ?? null);
  }
  for (const valueModule of config.valueModules) {
    push(valueModule.header, valueModule.body, valueModule.url, `module:${valueModule.id}`, valueModule.imageKind === "asset" ? valueModule.assetId : null);
  }
  return modules.slice(0, 10);
}

/**
 * Everything that can change after the pass was saved. PATCHed on every
 * broadcast and whenever the card design changes.
 */
export function buildObjectPatch(card: Card, baseUrl: string): GoogleObjectPatch {
  const config = normalizeGoogleConfig(card.googleConfig);
  const hero = cardUsesHero(card);
  const mode = effectiveGoogleCodeMode(card);
  const barcodeCode = mode === "code" ? resolveBarcode(card, baseUrl) : null;
  const textCode = mode === "text" ? config.code.text : "";
  const modules = valueModules(card, config, baseUrl);
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
      sourceUri: { uri: imageUrl(baseUrl, card, "icon") },
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
    textModulesData: textModules(card, config),
    ...(modules.length > 0 ? { valueAddedModuleData: modules } : {}),
    // Clear the legacy links module so old passes stop showing the default globe icons.
    linksModuleData: { uris: [] },
    ...(imageModule.length > 0 ? { imageModulesData: imageModule } : {}),
  };
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
