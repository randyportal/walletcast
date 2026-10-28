"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServices, type Services } from "@/lib/services";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { ensureBootstrapAdmin } from "@/lib/users/bootstrap";
import { EmailTakenError, UsernameTakenError } from "@/lib/users/repository";
import { UserCreateSchema, UserUpdateSchema } from "@/lib/users/validation";
import { clientIp, createRateLimiter } from "@/lib/http/rateLimit";
import { mapWithConcurrency } from "@/lib/http/concurrency";
import { CardInputSchema, MessageInputSchema, type CardInput } from "@/lib/cards/validation";
import { SlugTakenError } from "@/lib/cards/repository";
import {
  ImageUploadError,
  processBackgroundUpload,
  processFaviconUpload,
  processIconUpload,
  processAppleImageUpload,
  processImageModuleUpload,
  processLinkIconUpload,
  processLogoUpload,
  processModuleImageUpload,
} from "@/lib/cards/images";
import { broadcast } from "@/lib/broadcast/broadcast";
import { buildGenericClass, buildObjectPatch, objectId } from "@/lib/google/objects";
import type { Card } from "@/lib/db/schema";
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
    return { error: "ADMIN_PASSWORD y SESSION_SECRET deben estar configurados en el servidor." };
  }
  if (!loginLimiter.hit(clientIp(await headers()))) {
    return { error: "Demasiados intentos. Espera 15 minutos." };
  }
  const identifier = formData.get("identifier");
  const password = formData.get("password");
  if (typeof identifier !== "string" || identifier.trim() === "" || typeof password !== "string") {
    return { error: "Escribe tu correo o usuario y tu contraseña." };
  }

  await ensureBootstrapAdmin(db, { username: config.adminUsername, password: config.adminPassword });

  const user = await users.findByIdentifier(identifier);
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.enabled || !ok) {
    return { error: "Correo, usuario o contraseña incorrectos." };
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

async function parseCardForm(formData: FormData, existing: Card | null) {
  const parsed = CardInputSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { state: { error: "Corrige los campos marcados.", fieldErrors } as FormState };
  }
  try {
    const logoFile = formData.get("logo");
    const iconFile = formData.get("icon");
    const backgroundFile = formData.get("background");
    const faviconFile = formData.get("favicon");
    const appleImageFile = formData.get("appleImage");
    const removeBackground = formData.get("removeBackground") === "on";
    const removeAppleImage = formData.get("removeAppleImage") === "on";
    const background = removeBackground
      ? null
      : await processBackgroundUpload(backgroundFile instanceof File ? backgroundFile : null);
    if (parsed.data.backgroundType === "image" && !background && !existing?.backgroundImage) {
      return { state: { error: "Sube una imagen de fondo o elige un fondo sólido/degradado.", fieldErrors: { background: "Obligatoria para el fondo de imagen" } } as FormState };
    }
    const images = {
      logo: formData.get("removeLogo") === "on" ? null : await processLogoUpload(logoFile instanceof File ? logoFile : null),
      icon: formData.get("removeIcon") === "on" ? null : await processIconUpload(iconFile instanceof File ? iconFile : null),
      background,
      favicon: formData.get("removeFavicon") === "on" ? null : await processFaviconUpload(faviconFile instanceof File ? faviconFile : null),
      appleImage: removeAppleImage ? null : await processAppleImageUpload(appleImageFile instanceof File ? appleImageFile : null),
    };
    return { input: parsed.data, images };
  } catch (error) {
    if (error instanceof ImageUploadError) return { state: { error: error.message } as FormState };
    throw error;
  }
}

async function processEntityUploads(cardId: string, formData: FormData, input: CardInput, services: Services): Promise<CardInput> {
  const links = input.links.map((link) => ({ ...link }));
  for (const link of links) {
    const file = formData.get(`linkIcon:${link.id}`);
    if (file instanceof File && file.size > 0 && formData.get(`removeLinkIcon:${link.id}`) !== "on") {
      const data = await processLinkIconUpload(file);
      if (data) {
        const asset = await services.assets.create({ cardId, kind: "link-icon", mime: "image/png", data });
        link.iconAssetId = asset.id;
      }
    }
  }

  const googleConfig = {
    ...input.googleConfig,
    valueModules: input.googleConfig.valueModules.map((valueModule) => ({ ...valueModule })),
    imageModule: input.googleConfig.imageModule ? { ...input.googleConfig.imageModule } : null,
  };
  for (const valueModule of googleConfig.valueModules) {
    const file = formData.get(`valueImage:${valueModule.id}`);
    if (file instanceof File && file.size > 0 && formData.get(`removeValueImage:${valueModule.id}`) !== "on") {
      const data = await processModuleImageUpload(file);
      if (data) {
        const asset = await services.assets.create({ cardId, kind: "module-image", mime: "image/jpeg", data });
        valueModule.imageKind = "asset";
        valueModule.assetId = asset.id;
      }
    } else if (valueModule.imageKind === "asset" && !valueModule.assetId) {
      valueModule.imageKind = "preset";
    }
  }

  const imageFile = formData.get("imageModuleFile");
  if (googleConfig.imageModule && imageFile instanceof File && imageFile.size > 0) {
    const data = await processImageModuleUpload(imageFile);
    if (data) {
      const description = googleConfig.imageModule?.description ?? "";
      const asset = await services.assets.create({ cardId, kind: "image-module", mime: "image/jpeg", data });
      googleConfig.imageModule = { assetId: asset.id, description };
    }
  } else if (googleConfig.imageModule && !googleConfig.imageModule.assetId) {
    googleConfig.imageModule = null;
  }

  return { ...input, links, googleConfig };
}

function referencedAssetIds(input: CardInput): string[] {
  const ids = new Set<string>();
  for (const link of input.links) if (link.iconAssetId) ids.add(link.iconAssetId);
  for (const valueModule of input.googleConfig.valueModules) if (valueModule.assetId) ids.add(valueModule.assetId);
  if (input.googleConfig.imageModule?.assetId) ids.add(input.googleConfig.imageModule.assetId);
  return [...ids];
}

async function syncGoogleCard(card: Card, services: Services): Promise<string[]> {
  const { googleApi, config, subscribers } = services;
  const google = config.google;
  if (!googleApi || !google) return [];
  const warnings: string[] = [];
  try {
    await googleApi.upsertGenericClass(buildGenericClass(google.issuerId, card));
  } catch (error) {
    warnings.push(`Google class: ${error instanceof Error ? error.message : String(error)}`);
  }
  const targets = await subscribers.listActiveGoogle(card.id);
  if (targets.length > 0) {
    const patch = buildObjectPatch(card, config.baseUrl);
    const outcomes = await mapWithConcurrency(targets, 10, async (subscriber) => {
      try {
        await googleApi.patchGenericObject(objectId(google.issuerId, subscriber), patch);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    const failures = outcomes.filter((value): value is string => value !== null);
    if (failures.length > 0) warnings.push(`Google passes: ${failures.slice(0, 3).join("; ")}`);
  }
  return warnings;
}

export async function createCardAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await parseCardForm(formData, null);
  if (!result.input) return result.state;
  const services = await getServices();
  let card: Card;
  try {
    card = await services.cards.create(result.input, result.images);
  } catch (error) {
    if (error instanceof SlugTakenError) return { error: "Este enlace ya está en uso.", fieldErrors: { slug: "Ya está ocupado" } };
    throw error;
  }
  try {
    const finalInput = await processEntityUploads(card.id, formData, result.input, services);
    card = (await services.cards.update(card.id, finalInput)) ?? card;
    await services.assets.deleteUnreferenced(card.id, referencedAssetIds(finalInput));
  } catch (error) {
    if (error instanceof ImageUploadError) {
      await services.cards.delete(card.id);
      return { error: error.message };
    }
    throw error;
  }
  await syncGoogleCard(card, services);
  revalidatePath("/dashboard");
  redirect(`/dashboard/cards/${card.id}`);
}

export async function updateCardAction(cardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const services = await getServices();
  const existing = await services.cards.findById(cardId);
  if (!existing) return { error: "Tarjeta no encontrada." };
  const result = await parseCardForm(formData, existing);
  if (!result.input) return result.state;

  let finalInput: CardInput;
  try {
    finalInput = await processEntityUploads(cardId, formData, result.input, services);
  } catch (error) {
    if (error instanceof ImageUploadError) return { error: error.message };
    throw error;
  }

  let card: Card | null;
  try {
    card = await services.cards.update(cardId, finalInput, result.images);
  } catch (error) {
    if (error instanceof SlugTakenError) return { error: "Este enlace ya está en uso.", fieldErrors: { slug: "Ya está ocupado" } };
    throw error;
  }
  if (!card) return { error: "Tarjeta no encontrada." };

  await services.assets.deleteUnreferenced(cardId, referencedAssetIds(finalInput));
  if (services.apns) await services.apns.sendPassUpdates(await services.subscribers.applePushTokensForCard(cardId));
  const warnings = await syncGoogleCard(card, services);
  revalidatePath(`/dashboard/cards/${cardId}`);
  revalidatePath(`/c/${finalInput.slug}`);
  return { success: "Guardado. Los pases existentes se actualizarán.", warnings };
}

export async function syncGoogleCardAction(cardId: string): Promise<void> {
  await requireAdmin();
  const services = await getServices();
  const card = await services.cards.findById(cardId);
  if (!card) redirect("/dashboard");
  if (!services.googleApi || !services.config.google) {
    redirect(`/dashboard/cards/${cardId}?googleError=not-configured`);
  }
  const warnings = await syncGoogleCard(card, services);
  revalidatePath(`/dashboard/cards/${cardId}`);
  if (warnings.length > 0) {
    redirect(`/dashboard/cards/${cardId}?googleWarn=${encodeURIComponent(warnings.join(" | ").slice(0, 220))}`);
  }
  redirect(`/dashboard/cards/${cardId}?googleSynced=1`);
}

export async function syncAllGoogleAction(): Promise<void> {
  await requireAdmin();
  const services = await getServices();
  if (!services.googleApi || !services.config.google) {
    redirect("/dashboard?googleError=not-configured");
  }
  const list = await services.cards.listWithStats();
  let synced = 0;
  let failed = 0;
  for (const item of list) {
    const card = await services.cards.findById(item.id);
    if (!card) continue;
    const warnings = await syncGoogleCard(card, services);
    if (warnings.length > 0) failed += 1;
    else synced += 1;
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?googleSynced=${synced}&googleFailed=${failed}`);
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Mensaje inválido" };

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
    return { error: "Corrige los campos marcados.", fieldErrors };
  }
  const { users } = await getServices();
  try {
    await users.create(parsed.data);
  } catch (error) {
    if (error instanceof UsernameTakenError) return { error: error.message, fieldErrors: { username: "Ocupado" } };
    if (error instanceof EmailTakenError) return { error: error.message, fieldErrors: { email: "Ocupado" } };
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
    return { error: "Corrige los campos marcados.", fieldErrors };
  }
  const { users } = await getServices();
  const target = await users.findById(userId);
  if (!target) return { error: "Usuario no encontrado." };

  const demotingOrDisablingAdmin =
    target.role === "admin" && (parsed.data.role !== "admin" || parsed.data.enabled === false);
  if (demotingOrDisablingAdmin) {
    if (userId === current.id) return { error: "No puedes quitarte el rol de administrador ni deshabilitarte." };
    const activeAdmins = await users.countActiveAdmins();
    if (activeAdmins <= 1) return { error: "No puedes quitar el rol ni deshabilitar al último administrador activo." };
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
    if (error instanceof UsernameTakenError) return { error: error.message, fieldErrors: { username: "Ocupado" } };
    if (error instanceof EmailTakenError) return { error: error.message, fieldErrors: { email: "Ocupado" } };
    throw error;
  }
  revalidatePath("/dashboard/users");
  return { success: "Usuario actualizado." };
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
