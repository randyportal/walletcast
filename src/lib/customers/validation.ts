import { z } from "zod";
import { CUSTOMER_STATUSES, JOIN_CONTACT_POLICIES, type JoinContactPolicy } from "@/lib/db/schema";

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email().max(254).nullable())
  .default(null);

export const optionalMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().min(7, "El móvil debe tener al menos 7 dígitos").max(20).nullable())
  .default(null);

export const CustomerInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  email: optionalEmail,
  mobile: optionalMobile,
  status: z.enum(CUSTOMER_STATUSES).default("active"),
});

export type CustomerInput = z.infer<typeof CustomerInputSchema>;

export const PublicJoinSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  email: optionalEmail,
  mobile: optionalMobile,
});

export type PublicJoinInput = z.infer<typeof PublicJoinSchema>;

export function contactSatisfiesPolicy(
  policy: JoinContactPolicy,
  contact: { email: string | null; mobile: string | null },
): boolean {
  switch (policy) {
    case "email":
      return Boolean(contact.email);
    case "mobile":
      return Boolean(contact.mobile);
    case "email_or_mobile":
      return Boolean(contact.email || contact.mobile);
    case "optional":
    default:
      return true;
  }
}

export function contactRequirementMessage(policy: JoinContactPolicy): string {
  switch (policy) {
    case "email":
      return "El correo electrónico es obligatorio.";
    case "mobile":
      return "El móvil es obligatorio.";
    case "email_or_mobile":
      return "Escribe tu correo o tu móvil.";
    default:
      return "";
  }
}

export const JOIN_CONTACT_POLICY_OPTIONS = JOIN_CONTACT_POLICIES.map((value) => ({
  value,
  label:
    value === "optional"
      ? "Solo nombre (sin contacto)"
      : value === "email"
        ? "Correo obligatorio"
        : value === "mobile"
          ? "Móvil obligatorio"
          : "Correo o móvil",
}));
