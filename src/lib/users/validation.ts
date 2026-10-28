import { z } from "zod";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email().max(254).nullable());

export const USER_ORG_ROLES = ["owner", "admin", "marketing", "staff", "viewer"] as const;

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Usuario: 3-32 caracteres en minúsculas, números, puntos, guiones o guiones bajos");

export const UserCreateSchema = z.object({
  username,
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  email: optionalEmail.default(null),
  role: z.enum(USER_ORG_ROLES).default("marketing"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(200),
});

export const UserUpdateSchema = z.object({
  username,
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  email: optionalEmail.default(null),
  role: z.enum(USER_ORG_ROLES),
  enabled: z.stringbool().default(true),
  password: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().min(8, "Mínimo 8 caracteres").max(200).nullable())
    .default(null),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
