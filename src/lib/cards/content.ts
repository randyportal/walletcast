import { z } from "zod";
import { type CardLink, type LinkIcon } from "./design";
import { normalizeGoogleConfig } from "./google";

export const CONTENT_VERSION = 2;

export interface ContentConfig {
  version: number;
  latest: {
    show: boolean;
    showHistory: boolean;
    historyTitle: string;
    historyLimit: number;
  };
  recommendations: {
    show: boolean;
    title: string;
  };
}

/** Default for rows created before contentConfig existed. Normalised on read. */
export const LEGACY_CONTENT_CONFIG: ContentConfig = {
  version: 0,
  latest: { show: true, showHistory: true, historyTitle: "Mensajes recientes", historyLimit: 5 },
  recommendations: { show: true, title: "Recomendaciones" },
};

/** Default used by the editor for new cards and after the legacy migration. */
export const DEFAULT_CONTENT_CONFIG: ContentConfig = {
  ...LEGACY_CONTENT_CONFIG,
  version: CONTENT_VERSION,
};

export const ContentConfigSchema = z.object({
  version: z.number().int().min(0).default(CONTENT_VERSION),
  latest: z
    .object({
      show: z.boolean().default(true),
      showHistory: z.boolean().default(true),
      historyTitle: z.string().trim().max(35, "Máximo 35 caracteres").default("Mensajes recientes"),
      historyLimit: z.coerce.number().int().min(1).max(10).default(5),
    })
    .default({ show: true, showHistory: true, historyTitle: "Mensajes recientes", historyLimit: 5 }),
  recommendations: z
    .object({
      show: z.boolean().default(true),
      title: z.string().trim().max(35, "Máximo 35 caracteres").default("Recomendaciones"),
    })
    .default({ show: true, title: "Recomendaciones" }),
});

export const ContentConfigInputSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, ContentConfigSchema.default(DEFAULT_CONTENT_CONFIG));

export function normalizeContentConfig(raw: unknown): ContentConfig {
  const parsed = ContentConfigSchema.safeParse(raw);
  if (parsed.success) return { ...parsed.data, version: Math.max(parsed.data.version, CONTENT_VERSION) };
  return DEFAULT_CONTENT_CONFIG;
}

export interface HistoryMessage {
  title: string;
  body: string;
  createdAt: Date;
}

export interface ContentInput {
  contentConfig?: unknown;
  links?: unknown;
  websiteUrl?: string | null;
  contactUrl?: string | null;
  googleConfig?: unknown;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normaliseLink(raw: Partial<CardLink> & { id: string; label: string; url: string }): CardLink {
  return {
    id: raw.id,
    label: raw.label,
    subtitle: raw.subtitle ?? "",
    url: raw.url,
    icon: (raw.icon ?? "link") as LinkIcon,
    style: raw.style ?? "secondary",
    iconAssetId: raw.iconAssetId ?? null,
    kind: raw.kind ?? "custom",
    visible: raw.visible ?? true,
  };
}

export interface NormalizedContent {
  config: ContentConfig;
  links: CardLink[];
}

/**
 * Accepts cards created before contentConfig/recommendation fields existed and
 * turns them into the current shape without writing to the database. The next
 * save persists version 2 and clears the legacy value modules.
 */
export function normalizeContent(input: ContentInput): NormalizedContent {
  const parsed = ContentConfigSchema.safeParse(input.contentConfig);
  const config: ContentConfig = parsed.success
    ? { ...parsed.data, version: Math.max(parsed.data.version, CONTENT_VERSION) }
    : { ...DEFAULT_CONTENT_CONFIG };

  const legacy = Array.isArray(input.links) ? (input.links as Partial<CardLink>[]) : [];
  const links: CardLink[] = legacy
    .filter((link): link is Partial<CardLink> & { id: string; label: string; url: string } =>
      typeof link?.id === "string" && typeof link?.label === "string" && typeof link?.url === "string",
    )
    .map(normaliseLink);

  const isLegacy = !parsed.success || (parsed.data.version ?? 0) < CONTENT_VERSION;
  if (isLegacy) {
    const google = normalizeGoogleConfig(input.googleConfig);
    for (const valueModule of google.valueModules) {
      const id = `vm_${valueModule.id}`;
      if (links.some((link) => link.id === id)) continue;
      links.push({
        id,
        label: valueModule.header,
        subtitle: valueModule.body,
        url: valueModule.url,
        icon: valueModule.icon,
        style: "secondary",
        iconAssetId: valueModule.imageKind === "asset" ? valueModule.assetId : null,
        kind: "custom",
        visible: true,
      });
    }
  }

  const hasKind = (kind: CardLink["kind"]) => links.some((link) => link.kind === kind);
  const hasUrl = (url: string) => links.some((link) => link.url === url);

  if (isLegacy && input.websiteUrl && !hasKind("website") && !hasUrl(input.websiteUrl)) {
    links.push({
      id: "website",
      label: "Sitio web",
      subtitle: hostOf(input.websiteUrl),
      url: input.websiteUrl,
      icon: "globe",
      style: "secondary",
      iconAssetId: null,
      kind: "website",
      visible: true,
    });
  }
  if (isLegacy && input.contactUrl && !hasKind("contact") && !hasUrl(input.contactUrl)) {
    links.push({
      id: "contact",
      label: "Guardar contacto",
      subtitle: "Agrega nuestros datos a tu teléfono",
      url: input.contactUrl,
      icon: "contact",
      style: "secondary",
      iconAssetId: null,
      kind: "contact",
      visible: true,
    });
  }

  return {
    config: { ...config, version: CONTENT_VERSION },
    links,
  };
}

/** Visible recommendations in the order the user chose. */
export function visibleRecommendations(links: CardLink[]): CardLink[] {
  return links.filter((link) => link.visible);
}

/** Previous messages, without the latest one shown on the front. */
export function previousMessages(messages: HistoryMessage[], latestMessage: string | null): HistoryMessage[] {
  if (messages.length === 0) return [];
  const first = messages[0];
  const latestText = latestMessage ?? "";
  if (latestText && `${first.title}: ${first.body}` === latestText) return messages.slice(1);
  return messages;
}

export function historyText(messages: HistoryMessage[], limit: number, locale = "es"): string {
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  return messages
    .slice(0, limit)
    .map((message) => {
      const text = `${message.title}: ${message.body}`;
      return `${dateFmt.format(message.createdAt)} - ${text.slice(0, 160)}`;
    })
    .join("\n");
}
