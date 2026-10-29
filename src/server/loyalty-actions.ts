"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServices } from "@/lib/services";
import { clientIp, createRateLimiter } from "@/lib/http/rateLimit";
import { CustomerInputSchema, contactRequirementMessage, contactSatisfiesPolicy } from "@/lib/customers/validation";
import { CustomerContactTakenError } from "@/lib/customers/repository";
import {
  AmbiguousCustomerError,
  CustomerContactRequiredError,
  LoyaltyUnavailableError,
  addStampForIssuedCard,
  issueCardForCustomer,
  joinPublicCard,
  redeemIssuedCard,
  removeStampForIssuedCard,
  revokeIssuedCard,
} from "@/lib/loyalty/service";
import { IssuedCardStateError } from "@/lib/loyalty/repository";
import { syncIssuedCardWallet } from "@/lib/loyalty/sync";
import { requireCustomerEditor, requireLoyaltyOperator, type CurrentUser } from "./auth";
import type { FormState } from "./actions";

const publicJoinLimiter = createRateLimiter({ limit: 12, windowMs: 60_000 });

function formFields(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function actorFor(user: CurrentUser) {
  return { userId: user.id, name: user.name || user.username, role: user.organizationRole };
}

async function syncWallet(
  services: Awaited<ReturnType<typeof getServices>>,
  organizationId: string,
  issuedCardId: string,
  notify?: { title: string; body: string } | null,
): Promise<string[]> {
  const org = await services.organizations.findById(organizationId);
  return syncIssuedCardWallet(
    {
      loyalty: services.loyalty,
      subscribers: services.subscribers,
      apns: services.apns,
      google:
        services.googleApi && services.config.google
          ? { api: services.googleApi, issuerId: services.config.google.issuerId }
          : null,
      baseUrl: services.config.baseUrl,
      timeZone: org?.timeZone ?? services.config.glowTimeZone,
    },
    issuedCardId,
    { notify },
  );
}

function loyaltyError(error: unknown): FormState {
  if (
    error instanceof CustomerContactRequiredError ||
    error instanceof LoyaltyUnavailableError ||
    error instanceof AmbiguousCustomerError ||
    error instanceof IssuedCardStateError ||
    error instanceof CustomerContactTakenError
  ) {
    return { error: error.message };
  }
  throw error;
}

export async function publicJoinAction(
  cardSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!publicJoinLimiter.hit(clientIp(await headers()))) {
    return { error: "Demasiados intentos. Espera un minuto." };
  }
  const services = await getServices();
  const card = await services.cards.findBySlug(cardSlug);
  if (!card) return { error: "Tarjeta no encontrada." };
  try {
    const result = await joinPublicCard(
      { customers: services.customers, loyalty: services.loyalty },
      {
        organizationId: card.organizationId,
        card,
        data: formFields(formData),
      },
    );
    revalidatePath(`/c/${card.slug}`);
    redirect(`/c/${card.slug}/${result.issuedCard.token}`);
  } catch (error) {
    return loyaltyError(error);
  }
}

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCustomerEditor();
  const parsed = CustomerInputSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Corrige los campos marcados.", fieldErrors };
  }
  const { customers } = await getServices();
  try {
    await customers.create(user.organizationId, parsed.data);
  } catch (error) {
    if (error instanceof CustomerContactTakenError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/customers");
  return { success: "Cliente creado." };
}

export async function updateCustomerAction(
  customerId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCustomerEditor();
  const parsed = CustomerInputSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Corrige los campos marcados.", fieldErrors };
  }
  const { customers } = await getServices();
  try {
    const updated = await customers.update(user.organizationId, customerId, parsed.data);
    if (!updated) return { error: "Cliente no encontrado." };
  } catch (error) {
    if (error instanceof CustomerContactTakenError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { success: "Cliente actualizado." };
}

export async function issueCardAction(
  cardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireLoyaltyOperator();
  const services = await getServices();
  const card = await services.cards.findById(user.organizationId, cardId);
  if (!card) return { error: "Tarjeta no encontrada." };
  if (!card.loyaltyEnabled) return { error: "Esta tarjeta no tiene lealtad activada." };
  if (card.archivedAt) return { error: "Esta campaña está archivada." };

  let customerId = String(formData.get("customerId") ?? "").trim();
  let customer = customerId ? await services.customers.findById(user.organizationId, customerId) : null;
  if (customerId && !customer) return { error: "Cliente no encontrado." };

  if (!customer) {
    const parsed = CustomerInputSchema.safeParse({
      name: formData.get("newName"),
      email: formData.get("newEmail"),
      mobile: formData.get("newMobile"),
      status: "active",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del cliente." };
    }
    if (!contactSatisfiesPolicy(card.joinContactPolicy, { email: parsed.data.email, mobile: parsed.data.mobile })) {
      return { error: contactRequirementMessage(card.joinContactPolicy) };
    }
    try {
      customer = await services.customers.create(user.organizationId, parsed.data);
    } catch (error) {
      if (error instanceof CustomerContactTakenError) {
        const matches = await services.customers.findByIdentity(user.organizationId, {
          email: parsed.data.email,
          mobile: parsed.data.mobile,
        });
        customer = matches[0] ?? null;
        if (!customer) return { error: error.message };
      } else {
        throw error;
      }
    }
    customerId = customer.id;
  }

  try {
    const result = await issueCardForCustomer(
      { customers: services.customers, loyalty: services.loyalty },
      {
        organizationId: user.organizationId,
        card,
        customer,
        actor: actorFor(user),
        remarks: "Emitida desde el panel",
      },
    );
    revalidatePath("/dashboard/issued-cards");
    revalidatePath(`/dashboard/cards/${cardId}`);
    revalidatePath(`/dashboard/customers/${customerId}`);
    redirect(`/dashboard/issued-cards?issued=${result.issuedCard.id}`);
  } catch (error) {
    return loyaltyError(error);
  }
}

async function eventAction(
  issuedCardId: string,
  action: "add" | "remove" | "redeem" | "revoke",
  formData?: FormData,
): Promise<FormState> {
  const user = await requireLoyaltyOperator();
  if (action === "revoke" && !(user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin)) {
    return { error: "Solo propietarios y administradores pueden revocar tarjetas." };
  }
  const services = await getServices();
  const issued = await services.loyalty.findByIdRow(user.organizationId, issuedCardId);
  if (!issued) return { error: "Tarjeta emitida no encontrada." };
  const remarks = formData ? String(formData.get("remarks") ?? "").trim() || null : null;
  try {
    if (action === "add") {
      const updated = await addStampForIssuedCard(
        { customers: services.customers, loyalty: services.loyalty },
        { organizationId: user.organizationId, card: issued.card, issuedCardId, actor: actorFor(user), remarks },
      );
      const completed = updated.stamps >= issued.card.stampsRequired;
      const notify = completed && issued.card.notifyOnReward
        ? { title: "Recompensa lista", body: `${issued.card.rewardName || "Tu recompensa"} ya está disponible.` }
        : issued.card.notifyOnStamp
          ? { title: "Sello agregado", body: `${updated.stamps}/${issued.card.stampsRequired} sellos en ${issued.card.name}.` }
          : null;
      const warnings = await syncWallet(services, user.organizationId, issuedCardId, notify);
      revalidatePath("/dashboard/scan");
      revalidatePath(`/dashboard/issued-cards`);
      revalidatePath(`/c/${issued.card.slug}/${issued.issuedCard.token}`);
      return { success: "Sello agregado.", warnings };
    }
    if (action === "remove") {
      const updated = await removeStampForIssuedCard(
        { customers: services.customers, loyalty: services.loyalty },
        { organizationId: user.organizationId, card: issued.card, issuedCardId, actor: actorFor(user), remarks },
      );
      const warnings = await syncWallet(services, user.organizationId, issuedCardId);
      revalidatePath("/dashboard/scan");
      revalidatePath(`/c/${issued.card.slug}/${issued.issuedCard.token}`);
      return { success: `Sello removido (${updated.stamps}).`, warnings };
    }
    if (action === "redeem") {
      const updated = await redeemIssuedCard(
        { customers: services.customers, loyalty: services.loyalty },
        { organizationId: user.organizationId, card: issued.card, issuedCardId, actor: actorFor(user), remarks },
      );
      const notify = issued.card.notifyOnRedeem
        ? { title: "Recompensa canjeada", body: updated.stamps ? `${issued.card.rewardName} entregada.` : "Recompensa entregada." }
        : null;
      const warnings = await syncWallet(services, user.organizationId, issuedCardId, notify);
      revalidatePath("/dashboard/scan");
      revalidatePath("/dashboard/issued-cards");
      revalidatePath(`/c/${issued.card.slug}/${issued.issuedCard.token}`);
      return { success: "Recompensa canjeada.", warnings };
    }
    const updated = await revokeIssuedCard(
      { customers: services.customers, loyalty: services.loyalty },
      { organizationId: user.organizationId, card: issued.card, issuedCardId, actor: actorFor(user), remarks },
    );
    const warnings = await syncWallet(services, user.organizationId, issuedCardId);
    revalidatePath("/dashboard/scan");
    revalidatePath("/dashboard/issued-cards");
    revalidatePath(`/c/${issued.card.slug}/${issued.issuedCard.token}`);
    return { success: `Tarjeta revocada (${updated.stamps} sellos).`, warnings };
  } catch (error) {
    return loyaltyError(error);
  }
}

export async function addStampAction(issuedCardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return eventAction(issuedCardId, "add", formData);
}

export async function removeStampAction(issuedCardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return eventAction(issuedCardId, "remove", formData);
}

export async function redeemCardAction(issuedCardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return eventAction(issuedCardId, "redeem", formData);
}

export async function revokeCardAction(issuedCardId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  return eventAction(issuedCardId, "revoke", formData);
}


export async function loyaltyEventAction(
  issuedCardId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const event = String(formData.get("event") ?? "");
  if (event === "add" || event === "remove" || event === "redeem" || event === "revoke") {
    return eventAction(issuedCardId, event, formData);
  }
  return { error: "Acción no válida." };
}


export async function revokeIssuedCardAction(issuedCardId: string): Promise<void> {
  const user = await requireLoyaltyOperator();
  if (!(user.organizationRole === "owner" || user.organizationRole === "admin" || user.isPlatformAdmin)) {
    redirect("/dashboard/issued-cards");
  }
  const services = await getServices();
  const issued = await services.loyalty.findByIdRow(user.organizationId, issuedCardId);
  if (!issued) redirect("/dashboard/issued-cards");
  await revokeIssuedCard(
    { customers: services.customers, loyalty: services.loyalty },
    { organizationId: user.organizationId, card: issued.card, issuedCardId, actor: actorFor(user), remarks: "Revocada desde el listado" },
  );
  await syncWallet(services, user.organizationId, issuedCardId);
  revalidatePath("/dashboard/issued-cards");
  redirect("/dashboard/issued-cards?revoked=1");
}
