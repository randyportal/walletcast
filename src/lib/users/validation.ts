import { z } from "zod";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email().max(254).nullable());

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Username: 3-32 lowercase letters, digits, dots, dashes, underscores");

export const UserCreateSchema = z.object({
  username,
  name: z.string().trim().min(1, "Name is required").max(60),
  email: optionalEmail.default(null),
  role: z.enum(["admin", "marketing"]).default("marketing"),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export const UserUpdateSchema = z.object({
  username,
  name: z.string().trim().min(1, "Name is required").max(60),
  email: optionalEmail.default(null),
  role: z.enum(["admin", "marketing"]),
  enabled: z.stringbool().default(true),
  password: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().min(8, "At least 8 characters").max(200).nullable())
    .default(null),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
