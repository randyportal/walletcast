import { z } from "zod";

export const BACKGROUND_TYPES = ["solid", "linear", "radial", "image"] as const;
export type BackgroundType = (typeof BACKGROUND_TYPES)[number];

export const BACKGROUND_POSITIONS = ["center", "top", "bottom", "left", "right"] as const;
export type BackgroundPosition = (typeof BACKGROUND_POSITIONS)[number];

export const FONT_FAMILIES = ["sans", "serif", "rounded", "mono", "condensed"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const ICON_SOURCES = ["auto", "preset", "monogram"] as const;
export type IconSource = (typeof ICON_SOURCES)[number];

export const ICON_PRESETS = [
  "star",
  "heart",
  "coffee",
  "gift",
  "ticket",
  "crown",
  "sparkles",
  "bag",
  "leaf",
  "bolt",
] as const;
export type IconPreset = (typeof ICON_PRESETS)[number];

export const ICON_SHAPES = ["rounded", "circle", "square"] as const;
export type IconShape = (typeof ICON_SHAPES)[number];

export const LINK_ICONS = [
  "link",
  "globe",
  "mail",
  "phone",
  "message",
  "pin",
  "instagram",
  "calendar",
  "bag",
  "star",
  "contact",
  "ticket",
  "heart",
  "coffee",
  "crown",
  "sparkles",
  "leaf",
  "bolt",
] as const;
export type LinkIcon = (typeof LINK_ICONS)[number];

export const LINK_STYLES = ["primary", "secondary", "outline"] as const;
export type LinkStyle = (typeof LINK_STYLES)[number];

export const BARCODE_TYPES = ["qr", "pdf417", "aztec", "code128"] as const;
export type BarcodeType = (typeof BARCODE_TYPES)[number];

export const BARCODE_CONTENTS = ["link", "website", "custom"] as const;
export type BarcodeContent = (typeof BARCODE_CONTENTS)[number];

export const FIELD_LOCATIONS = ["front", "back"] as const;
export type FieldLocation = (typeof FIELD_LOCATIONS)[number];

export const RECOMMENDATION_KINDS = ["custom", "website", "contact"] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export interface CardLink {
  id: string;
  label: string;
  subtitle: string;
  url: string;
  icon: LinkIcon;
  style: LinkStyle;
  iconAssetId: string | null;
  kind: RecommendationKind;
  visible: boolean;
}

export interface CardField {
  id: string;
  label: string;
  value: string;
  location: FieldLocation;
}

export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hex de 6 dígitos, por ejemplo #1a2b3c");

export const optionalHex = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(hexColor.nullable());

function allowedLink(value: string): boolean {
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const CardLinkSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "La etiqueta es obligatoria").max(60),
  subtitle: z.string().trim().max(50, "Máximo 50 caracteres").default(""),
  url: z.string().trim().min(1, "La URL es obligatoria").max(500).refine(allowedLink, "Usa un enlace http(s), mailto o tel"),
  icon: z.enum(LINK_ICONS).default("link"),
  style: z.enum(LINK_STYLES).default("secondary"),
  iconAssetId: z.string().min(1).max(64).nullable().default(null),
  kind: z.enum(RECOMMENDATION_KINDS).default("custom"),
  visible: z.boolean().default(true),
});

export const CardFieldSchema = z.object({
  id: z.string().min(1).max(20),
  label: z.string().trim().min(1, "La etiqueta es obligatoria").max(16),
  value: z.string().trim().min(1, "El valor es obligatorio").max(60),
  location: z.enum(FIELD_LOCATIONS).default("back"),
});

export const LinksSchema = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}, z.array(CardLinkSchema).max(12, "Máximo 12 recomendaciones"));

export const CustomFieldsSchema = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}, z.array(CardFieldSchema).max(8, "Máximo 8 campos"));

export function isHeroBackground(type: BackgroundType | string | null | undefined): boolean {
  return type === "linear" || type === "radial" || type === "image";
}

export function cardUsesHero(card: { dayGlow: boolean; backgroundType: BackgroundType | string | null }): boolean {
  return card.dayGlow || isHeroBackground(card.backgroundType);
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface CardBackgroundInput {
  backgroundType: string;
  bgColor: string;
  bgColor2: string | null;
  gradientAngle: number;
  backgroundOverlay: number;
  backgroundOverlayColor: string;
  backgroundPosition: string;
  backgroundImageUrl?: string | null;
}

export interface CardBackgroundStyle {
  backgroundColor: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
}

export function cardBackgroundStyle(input: CardBackgroundInput): CardBackgroundStyle {
  const overlay = hexToRgba(input.backgroundOverlayColor, input.backgroundOverlay / 100);
  switch (input.backgroundType) {
    case "linear":
      return {
        backgroundColor: input.bgColor,
        backgroundImage: `linear-gradient(${input.gradientAngle}deg, ${input.bgColor}, ${input.bgColor2 ?? input.bgColor})`,
      };
    case "radial":
      return {
        backgroundColor: input.bgColor,
        backgroundImage: `radial-gradient(circle at 50% 0%, ${input.bgColor}, ${input.bgColor2 ?? input.bgColor})`,
      };
    case "image":
      if (!input.backgroundImageUrl) return { backgroundColor: input.bgColor };
      return {
        backgroundColor: input.bgColor,
        backgroundImage: `linear-gradient(${overlay}, ${overlay}), url("${input.backgroundImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: input.backgroundPosition,
      };
    default:
      return { backgroundColor: input.bgColor };
  }
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}
