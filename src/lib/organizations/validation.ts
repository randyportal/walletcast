import { z } from "zod";

export const ORGANIZATION_CURRENCIES = ["MXN", "USD", "EUR"] as const;

export const OrganizationInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/, "Usa minúsculas, números y guiones"),
  currency: z.enum(ORGANIZATION_CURRENCIES).default("MXN"),
  timeZone: z
    .string()
    .trim()
    .default("America/Mexico_City")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Zona horaria inválida"),
});

export type OrganizationInput = z.infer<typeof OrganizationInputSchema>;

export const InvitationInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Correo inválido")),
  role: z.enum(["owner", "admin", "marketing", "staff", "viewer"]).default("staff"),
});

export type InvitationInput = z.infer<typeof InvitationInputSchema>;
