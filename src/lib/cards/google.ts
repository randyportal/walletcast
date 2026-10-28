import { z } from "zod";
import { LINK_ICONS, type LinkIcon } from "./design";

export const GOOGLE_PASS_TYPES = [
  "auto",
  "business",
  "loyalty",
  "membership",
  "voucher",
  "ticket",
  "receipt",
  "reservations",
  "gym",
  "library",
  "season",
  "parking",
  "utility",
  "autoInsurance",
  "homeInsurance",
  "other",
] as const;
export type GooglePassType = (typeof GOOGLE_PASS_TYPES)[number];

/**
 * Only values accepted by Google's current GenericType enum. Business,
 * membership and transit have no generic type of their own, so they fall
 * back to GENERIC_OTHER instead of sending an invalid value.
 */
export const GOOGLE_TYPE_ENUM: Record<Exclude<GooglePassType, "auto">, string> = {
  business: "GENERIC_OTHER",
  loyalty: "GENERIC_LOYALTY_CARD",
  membership: "GENERIC_OTHER",
  voucher: "GENERIC_VOUCHER",
  ticket: "GENERIC_ENTRY_TICKET",
  receipt: "GENERIC_RECEIPT",
  reservations: "GENERIC_RESERVATIONS",
  gym: "GENERIC_GYM_MEMBERSHIP",
  library: "GENERIC_LIBRARY_MEMBERSHIP",
  season: "GENERIC_SEASON_PASS",
  parking: "GENERIC_PARKING_PASS",
  utility: "GENERIC_UTILITY_BILLS",
  autoInsurance: "GENERIC_AUTO_INSURANCE",
  homeInsurance: "GENERIC_HOME_INSURANCE",
  other: "GENERIC_OTHER",
};

export const GOOGLE_TYPE_LABELS: Record<GooglePassType, string> = {
  auto: "Automático (Google)",
  business: "Tarjeta de negocio",
  loyalty: "Tarjeta de lealtad",
  membership: "Membresía",
  voucher: "Vale / cupón",
  ticket: "Boleto de entrada",
  receipt: "Recibo",
  reservations: "Reservación",
  gym: "Membresía de gimnasio",
  library: "Credencial de biblioteca",
  season: "Pase de temporada",
  parking: "Pase de estacionamiento",
  utility: "Recibo de servicios",
  autoInsurance: "Seguro de auto",
  homeInsurance: "Seguro de hogar",
  other: "Otro",
};

export const GOOGLE_CODE_MODES = ["auto", "code", "text", "hidden"] as const;
export type GoogleCodeMode = (typeof GOOGLE_CODE_MODES)[number];

export interface GoogleTextModule {
  id: string;
  header: string;
  body: string;
}

export interface GoogleValueModule {
  id: string;
  header: string;
  body: string;
  url: string;
  imageKind: "preset" | "asset";
  icon: LinkIcon;
  assetId: string | null;
}

export interface GoogleImageModule {
  assetId: string | null;
  description: string;
}

export interface GoogleConfig {
  type: GooglePassType;
  button: { label: string; url: string } | null;
  code: { mode: GoogleCodeMode; text: string };
  showLatest: boolean;
  showDescription: boolean;
  showCustomFields: boolean;
  textModules: GoogleTextModule[];
  valueModules: GoogleValueModule[];
  imageModule: GoogleImageModule | null;
}

export const DEFAULT_GOOGLE_CONFIG: GoogleConfig = {
  type: "auto",
  button: null,
  code: { mode: "auto", text: "" },
  showLatest: true,
  showDescription: true,
  showCustomFields: true,
  textModules: [],
  valueModules: [],
  imageModule: null,
};

const httpUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Usa un enlace http(s)");

const linkUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => {
    try {
      return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Usa un enlace http(s), mailto o tel");

export const GoogleTextModuleSchema = z.object({
  id: z.string().min(1).max(20),
  header: z.string().trim().min(1, "El encabezado es obligatorio").max(35),
  body: z.string().trim().min(1, "El texto es obligatorio").max(500),
});

export const GoogleValueModuleSchema = z.object({
  id: z.string().min(1).max(20),
  header: z.string().trim().min(1, "El encabezado es obligatorio").max(60),
  body: z.string().trim().max(50).default(""),
  url: linkUrl,
  imageKind: z.enum(["preset", "asset"]).default("preset"),
  icon: z.enum(LINK_ICONS).default("link"),
  assetId: z.string().min(1).max(64).nullable().default(null),
});

export const GoogleImageModuleSchema = z.object({
  assetId: z.string().min(1).max(64).nullable().default(null),
  description: z.string().trim().max(100).default(""),
});

export const GoogleConfigSchema = z
  .object({
    type: z.enum(GOOGLE_PASS_TYPES).default("auto"),
    button: z.object({ label: z.string().trim().min(1, "La etiqueta es obligatoria").max(30), url: httpUrl }).nullable().default(null),
    code: z
      .object({
        mode: z.enum(GOOGLE_CODE_MODES).default("auto"),
        text: z.string().trim().max(60).default(""),
      })
      .default({ mode: "auto", text: "" }),
    showLatest: z.boolean().default(true),
    showDescription: z.boolean().default(true),
    showCustomFields: z.boolean().default(true),
    textModules: z.array(GoogleTextModuleSchema).max(6).default([]),
    valueModules: z.array(GoogleValueModuleSchema).max(10).default([]),
    imageModule: GoogleImageModuleSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.code.mode === "text" && !value.code.text) {
      ctx.addIssue({ code: "custom", path: ["code", "text"], message: "Escribe el texto que sustituirá al código" });
    }
  });

export const GoogleConfigInputSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, GoogleConfigSchema);

export function normalizeGoogleConfig(raw: unknown): GoogleConfig {
  const parsed = GoogleConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return DEFAULT_GOOGLE_CONFIG;
}

export function effectiveGoogleCodeMode(card: { barcode: boolean; googleConfig?: unknown }): GoogleCodeMode {
  const config = normalizeGoogleConfig(card.googleConfig);
  // The card-level QR switch is the master. Text does not need a barcode, but
  // "code" can never force a QR when the master switch is off.
  if (!card.barcode) return config.code.mode === "text" ? "text" : "hidden";
  if (config.code.mode === "auto") return "code";
  return config.code.mode;
}
