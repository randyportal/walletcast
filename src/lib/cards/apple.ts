import { z } from "zod";

export interface AppleTextModule {
  id: string;
  header: string;
  body: string;
}

/**
 * Apple's equivalent of the Google customization options. Apple does not
 * allow a floating button or inline image modules, so links become back
 * fields and the image becomes the pass banner (strip).
 */
export interface AppleConfig {
  showDescription: boolean;
  showCustomFields: boolean;
  codeText: string;
  button: { label: string; url: string } | null;
  textModules: AppleTextModule[];
  imageDescription: string;
}

export const DEFAULT_APPLE_CONFIG: AppleConfig = {
  showDescription: true,
  showCustomFields: true,
  codeText: "",
  button: null,
  textModules: [],
  imageDescription: "",
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

export const AppleTextModuleSchema = z.object({
  id: z.string().min(1).max(20),
  header: z.string().trim().min(1, "El encabezado es obligatorio").max(35),
  body: z.string().trim().min(1, "El texto es obligatorio").max(500),
});

export const AppleConfigSchema = z.object({
  showDescription: z.boolean().default(true),
  showCustomFields: z.boolean().default(true),
  codeText: z.string().trim().max(60, "Máximo 60 caracteres").default(""),
  button: z
    .object({
      label: z.string().trim().min(1, "La etiqueta es obligatoria").max(30),
      url: httpUrl,
    })
    .nullable()
    .default(null),
  textModules: z.array(AppleTextModuleSchema).max(6).default([]),
  imageDescription: z.string().trim().max(100, "Máximo 100 caracteres").default(""),
});

export const AppleConfigInputSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, AppleConfigSchema);

export function normalizeAppleConfig(raw: unknown): AppleConfig {
  const parsed = AppleConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return DEFAULT_APPLE_CONFIG;
}
