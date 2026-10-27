import { z } from "zod";
import {
  BACKGROUND_POSITIONS,
  BACKGROUND_TYPES,
  BARCODE_CONTENTS,
  BARCODE_TYPES,
  CustomFieldsSchema,
  FONT_FAMILIES,
  hexColor,
  ICON_PRESETS,
  ICON_SHAPES,
  ICON_SOURCES,
  LinksSchema,
  optionalHex,
} from "./design";

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.url({ protocol: /^https?$/ }).nullable());

export const CardInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  organizationName: z.string().trim().min(1, "Organization is required").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Slug: lowercase letters, digits and dashes (max 48)"),
  description: z.string().trim().max(500).default(""),
  welcomeText: z.string().trim().max(200).default(""),
  websiteUrl: optionalUrl.default(null),
  bgColor: hexColor.default("#111827"),
  fgColor: hexColor.default("#ffffff"),
  labelColor: hexColor.default("#9ca3af"),
  barcode: z.stringbool().default(false),
  latestLabel: z
    .string()
    .trim()
    .transform((v) => v || "LATEST")
    .pipe(z.string().max(12, "Label: 12 characters max"))
    .default("LATEST"),
  contactUrl: optionalUrl.default(null),
  logoText: z.string().trim().max(20, "Logo text: 20 characters max").default(""),
  headerLabel: z.string().trim().max(12, "Header label: 12 characters max").default(""),
  headerValue: z.string().trim().max(20, "Header value: 20 characters max").default(""),
  nameLabel: z.string().trim().max(24, "Label above the name: 24 characters max").default(""),
  dayGlow: z.stringbool().default(false),
  backgroundType: z.enum(BACKGROUND_TYPES).default("solid"),
  bgColor2: optionalHex.default(null),
  gradientAngle: z.coerce.number().int().min(0).max(360).default(135),
  backgroundOverlay: z.coerce.number().int().min(0).max(80).default(35),
  backgroundOverlayColor: hexColor.default("#000000"),
  backgroundPosition: z.enum(BACKGROUND_POSITIONS).default("center"),
  accentColor: hexColor.default("#4f46e5"),
  fontFamily: z.enum(FONT_FAMILIES).default("sans"),
  iconSource: z.enum(ICON_SOURCES).default("auto"),
  iconPreset: z.union([z.enum(ICON_PRESETS), z.literal("")]).default(""),
  iconShape: z.enum(ICON_SHAPES).default("rounded"),
  monogramText: z.string().trim().max(2, "2 characters max").default(""),
  links: LinksSchema.default([]),
  customFields: CustomFieldsSchema.default([]),
  barcodeType: z.enum(BARCODE_TYPES).default("qr"),
  barcodeContent: z.enum(BARCODE_CONTENTS).default("link"),
  barcodeValue: z
    .string()
    .trim()
    .max(240)
    .transform((v) => (v === "" ? null : v))
    .default(null),
}).superRefine((input, ctx) => {
  if ((input.backgroundType === "linear" || input.backgroundType === "radial") && !input.bgColor2) {
    ctx.addIssue({ code: "custom", path: ["bgColor2"], message: "Choose a second color for the gradient" });
  }
  if (input.barcodeContent === "custom" && !input.barcodeValue) {
    ctx.addIssue({ code: "custom", path: ["barcodeValue"], message: "Enter the text to encode" });
  }
  if (input.barcodeType === "code128" && input.barcodeValue && !/^[\x20-\x7E]*$/.test(input.barcodeValue)) {
    ctx.addIssue({ code: "custom", path: ["barcodeValue"], message: "Code 128 supports plain ASCII text only" });
  }
  if (input.customFields.filter((f) => f.location === "front").length > 4) {
    ctx.addIssue({ code: "custom", path: ["customFields"], message: "Up to 4 fields on the front of the card" });
  }
});

export type CardInput = z.infer<typeof CardInputSchema>;

export const MessageInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(40),
  body: z.string().trim().min(1, "Message is required").max(300),
});

export type MessageInput = z.infer<typeof MessageInputSchema>;

/** Derive a URL-safe slug from free text ("Lu's Café" -> "lus-cafe"). */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "card";
}
