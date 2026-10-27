"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServices } from "@/lib/services";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { ensureBootstrapAdmin } from "@/lib/users/bootstrap";
import { EmailTakenError, UsernameTakenError } from "@/lib/users/repository";
import { UserCreateSchema, UserUpdateSchema } from "@/lib/users/validation";
import { clientIp, createRateLimiter } from "@/lib/http/rateLimit";
import { CardInputSchema, MessageInputSchema } from "@/lib/cards/validation";
import { SlugTakenError } from "@/lib/cards/repository";
import {
  ImageUploadError,
  processBackgroundUpload,
  processFaviconUpload,
  processIconUpload,
  processLogoUpload,
} from "@/lib/cards/images";
import { broadcast } from "@/lib/broadcast/broadcast";
import { requireAdmin, requireUser } from "./auth";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  warnings?: string[];
}

const loginLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });

const DUMMY_HASH =
  "scrypt$16384$8$1$SGAvljY2igmNMDT8FYD2Ig==$fwSjmutV2WInGS+sz596YzqHlSw40XJTGFdohS7a02ewlIjfMU0fp4UvVRA7KldJZ5ApmubS8r2+xrfrYYM3Zw==";

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/dashboard") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { config, db, users } = await getServices();
  if (!config.adminPassword || !config.sessionSecret) {
    return { error: "ADMIN_PASSWORD and SESSION_SECRET must be set on the server." };
  }
  if (!loginLimiter.hit(clientIp(await headers()))) {
    return { error: "Too many attempts. Wait 15 minutes." };
  }
  const identifier = formData.get("identifier");
  const password = formData.get("password");
  if (typeof identifier !== "string" || identifier.trim() === "" || typeof password !== "string") {
    return { error: "Enter your email or username and password." };
  }

  await ensureBootstrapAdmin(db, { username: config.adminUsername, password: config.adminPassword });

  const user = await users.findByIdentifier(identifier);
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.enabled || !ok) {
    return { error: "Wrong email/username or password." };
  }

  await users.touchLastLogin(user.id);
  const token = await createSessionToken(config.sessionSecret, {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(config.baseUrl.startsWith("https://")));
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

function formFields(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function parseCardForm(formData: FormData, hasBackground: boolean) {
  const parsed = CardInputSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { state: { error: "Please fix the highlighted fields.", fieldErrors } as FormState };
  }
  try {
    const logoFile = formData.get("logo");
    const iconFile = formData.get("icon");
    const backgroundFile = formData.get("background");
    const faviconFile = formData.get("favicon");
    const removeBackground = formData.get("removeBackground") === "on";
    const background = removeBackground
      ? null
      : await processBackgroundUpload(backgroundFile instanceof File ? backgroundFile : null);
    if (parsed.data.backgroundType === "image" && !background && !hasBackground) {
      return { state: { error: "Upload a background image or choose a solid/gradient background.", fieldErrors: { background: "Required for image background" } } as FormState };
    }
    const images = {
      logo: formData.get("removeLogo") === "on" ? null : await processLogoUpload(logoFile instanceof File ? logoFile : null),
      icon: formData.get("removeIcon") === "on" ? null : await processIconUpload(iconFile instanceof File ? iconFile : null),
      background,
      favicon: formData.get("removeFavicon") === "on" ? null : await processFaviconUpload(faviconFile instanceof File ? faviconFile : null),
    };
    return { input: parsed.data, images };
  } catch (error) {
    if (error instanceof ImageUploadError) return { state: { error: error.message } as FormState };
    throw error;
  }
}

export async function createCardAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await parseCardForm(formData, false);
  if (!result.input) return result.state;
  const { cards } = await getServices();
  let id: string;
  try {
    id = (await cards.create(result.input, result.images)).id;
  } catch (error) {
    if (error instanceof SlugTakenError) return { error: "This link is already used.", fieldErrors: { slug: "Already taken" } };
    throw error;
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/cards/${id}`);
}

export async function updateCardAction(cardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const { cards } = await getServices();
  const existing = await cards.findById(cardId);
  const result = await parseCardForm(formData, Boolean(existing?.backgroundImage));
  if (!result.input) return result.state;
  const { subscribers, apns } = await getServices();
  try {
    const card = await cards.update(cardId, result.input, result.images);
    if (!card) return { error: "Card not found." };
  } catch (error) {
    if (error instanceof SlugTakenError) return { error: "This link is already used.", fieldErrors: { slug: "Already taken" } };
    throw error;
  }
  if (apns) await apns.sendPassUpdates(await subscribers.applePushTokensForCard(cardId));
  revalidatePath(`/dashboard/cards/${cardId}`);
  revalidatePath(`/c/${result.input.slug}`);
  return { success: "Saved. Apple passes refresh now; Google passes on the next message." };
}

export async function deleteCardAction(cardId: string): Promise<void> {
  await requireAdmin();
  const { cards } = await getServices();
  await cards.delete(cardId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function sendMessageAction(cardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = MessageInputSchema.safeParse(formFields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message" };

  const services = await getServices();
  const { config } = services;
  const result = await broadcast(
    {
      db: services.db,
      baseUrl: config.baseUrl,
      cards: services.cards,
      subscribers: services.subscribers,
      apns: services.apns,
      google: services.googleApi && config.google ? { api: services.googleApi, issuerId: config.google.issuerId } : null,
    },
    cardId,
    parsed.data,
    user.name || user.username,
  );
  revalidatePath(`/dashboard/cards/${cardId}`);
  revalidatePath(`/dashboard/send/${cardId}`);
  const m = result.message;
  const delivered = m.appleSent + m.googleSent;
  const targets = m.appleTargets + m.googleTargets;
  return {
    success: `Sent to ${delivered} of ${targets} wallet${targets === 1 ? "" : "s"}.`,
    warnings: [...result.warnings, ...result.errors],
  };
}

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = UserCreateSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { users } = await getServices();
  try {
    await users.create(parsed.data);
  } catch (error) {
    if (error instanceof UsernameTakenError) return { error: error.message, fieldErrors: { username: "Taken" } };
    if (error instanceof EmailTakenError) return { error: error.message, fieldErrors: { email: "Taken" } };
    throw error;
  }
  revalidatePath("/dashboard/users");
  return { success: `User ${parsed.data.username} created.` };
}

export async function updateUserAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const current = await requireAdmin();
  const parsed = UserUpdateSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { users } = await getServices();
  const target = await users.findById(userId);
  if (!target) return { error: "User not found." };

  const demotingOrDisablingAdmin =
    target.role === "admin" && (parsed.data.role !== "admin" || parsed.data.enabled === false);
  if (demotingOrDisablingAdmin) {
    if (userId === current.id) return { error: "You cannot demote or disable yourself." };
    const activeAdmins = await users.countActiveAdmins();
    if (activeAdmins <= 1) return { error: "You cannot demote or disable the last active admin." };
  }

  try {
    await users.update(userId, {
      username: parsed.data.username,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      enabled: parsed.data.enabled,
    });
    if (parsed.data.password) await users.setPassword(userId, parsed.data.password);
  } catch (error) {
    if (error instanceof UsernameTakenError) return { error: error.message, fieldErrors: { username: "Taken" } };
    if (error instanceof EmailTakenError) return { error: error.message, fieldErrors: { email: "Taken" } };
    throw error;
  }
  revalidatePath("/dashboard/users");
  return { success: "User updated." };
}

export async function deleteUserAction(userId: string): Promise<void> {
  const current = await requireAdmin();
  if (userId === current.id) redirect("/dashboard/users?error=self");
  const { users } = await getServices();
  const target = await users.findById(userId);
  if (target && target.role === "admin" && target.enabled) {
    const activeAdmins = await users.countActiveAdmins();
    if (activeAdmins <= 1) redirect("/dashboard/users?error=lastadmin");
  }
  await users.remove(userId);
  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}
