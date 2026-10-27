import type { Card, Subscriber } from "@/lib/db/schema";
import { latestMessageText } from "@/lib/apple/pass";
import { cardUsesHero } from "@/lib/cards/design";
import { GOOGLE_BARCODE_TYPES, resolveBarcode } from "@/lib/cards/barcode";

/**
 * Mapping WalletCast cards/subscribers to Google Wallet Generic passes.
 * https://developers.google.com/wallet/generic/rest/v1/genericobject
 */

const localized = (value: string) => ({ defaultValue: { language: "en", value } });

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

export function buildGenericClass(issuerId: string, card: Card) {
  return {
    id: classId(issuerId, card),
    // Row showing the latest broadcast on the card front.
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            oneItem: {
              item: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['latest']" }],
                },
              },
            },
          },
        ],
      },
    },
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

/**
 * Everything that can change after the pass was saved. PATCHed on every
 * broadcast so design edits also reach Google passes.
 */
export function buildObjectPatch(card: Card, baseUrl: string) {
  const hero = cardUsesHero(card);
  const barcode = resolveBarcode(card, baseUrl);

  const links: { uri: string; description: string; id: string }[] = [];
  if (card.websiteUrl) links.push({ uri: card.websiteUrl, description: "Website", id: "website" });
  if (card.contactUrl) links.push({ uri: card.contactUrl, description: "Save contact", id: "contact" });
  for (const link of card.links) {
    links.push({ uri: link.url, description: link.label, id: `link_${link.id}` });
  }

  const textModulesData = [
    { id: "latest", header: "Latest", body: latestMessageText(card) },
    ...(card.description ? [{ id: "about", header: "About", body: card.description }] : []),
    ...card.customFields.map((field) => ({ id: `cf_${field.id}`, header: field.label, body: field.value })),
  ];

  return {
    cardTitle: localized(card.organizationName),
    header: localized(card.name),
    hexBackgroundColor: card.bgColor,
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
    ...(barcode ? { barcode: { type: GOOGLE_BARCODE_TYPES[barcode.format], value: barcode.value } } : {}),
    textModulesData,
    linksModuleData: {
      uris: links,
    },
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
