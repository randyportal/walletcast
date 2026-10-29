import type { Card, Customer, IssuedCard } from "@/lib/db/schema";
import type { CustomerRepository } from "@/lib/customers/repository";
import type { IssuedCardRow, LoyaltyActor, LoyaltyRepository } from "./repository";
import { CustomerContactTakenError } from "@/lib/customers/repository";
import {
  CustomerInputSchema,
  PublicJoinSchema,
  contactRequirementMessage,
  contactSatisfiesPolicy,
} from "@/lib/customers/validation";

export class LoyaltyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoyaltyUnavailableError";
  }
}

export class CustomerContactRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerContactRequiredError";
  }
}

export class AmbiguousCustomerError extends Error {
  constructor() {
    super("El correo y el móvil pertenecen a clientes distintos. Pide ayuda al negocio.");
    this.name = "AmbiguousCustomerError";
  }
}

export interface LoyaltyServiceDeps {
  customers: CustomerRepository;
  loyalty: LoyaltyRepository;
}

function assertCardAvailable(card: Card, organizationId: string): void {
  if (card.organizationId !== organizationId) throw new LoyaltyUnavailableError("Tarjeta no encontrada.");
  if (!card.loyaltyEnabled) throw new LoyaltyUnavailableError("Esta tarjeta no tiene lealtad activada.");
}

function assertCardIssuable(card: Card, organizationId: string): void {
  assertCardAvailable(card, organizationId);
  if (card.archivedAt) throw new LoyaltyUnavailableError("Esta campaña está archivada.");
}

function assertContact(card: Card, contact: { email: string | null; mobile: string | null }): void {
  if (!contactSatisfiesPolicy(card.joinContactPolicy, contact)) {
    throw new CustomerContactRequiredError(contactRequirementMessage(card.joinContactPolicy));
  }
}

function pickCustomer(matches: Customer[], contact: { email: string | null; mobile: string | null }): Customer | null {
  if (matches.length === 0) return null;
  const unique = new Map(matches.map((customer) => [customer.id, customer]));
  if (unique.size > 1) {
    const byEmail = contact.email ? matches.filter((customer) => customer.email === contact.email) : [];
    const byMobile = contact.mobile ? matches.filter((customer) => customer.mobile === contact.mobile) : [];
    if (byEmail.length > 0 && byMobile.length > 0 && byEmail[0].id !== byMobile[0].id) {
      throw new AmbiguousCustomerError();
    }
    return [...unique.values()][0];
  }
  return [...unique.values()][0];
}

export async function issueCardForCustomer(
  deps: LoyaltyServiceDeps,
  input: {
    organizationId: string;
    card: Card;
    customer: Customer;
    actor?: LoyaltyActor;
    remarks?: string | null;
  },
): Promise<{ issuedCard: IssuedCard; created: boolean }> {
  assertCardIssuable(input.card, input.organizationId);
  if (input.customer.organizationId !== input.organizationId) {
    throw new LoyaltyUnavailableError("Cliente no encontrado.");
  }
  if (input.customer.status !== "active") {
    throw new LoyaltyUnavailableError("Este cliente está inactivo.");
  }
  assertContact(input.card, { email: input.customer.email, mobile: input.customer.mobile });
  return deps.loyalty.create({
    organizationId: input.organizationId,
    cardId: input.card.id,
    customerId: input.customer.id,
    actor: input.actor,
    remarks: input.remarks,
  });
}

export async function joinPublicCard(
  deps: LoyaltyServiceDeps,
  input: {
    organizationId: string;
    card: Card;
    data: unknown;
    actor?: LoyaltyActor;
  },
): Promise<{ issuedCard: IssuedCard; customer: Customer; createdCustomer: boolean; createdCard: boolean }> {
  const parsed = PublicJoinSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new CustomerContactRequiredError(parsed.error.issues[0]?.message ?? "Revisa tus datos.");
  }
  const contact = { email: parsed.data.email, mobile: parsed.data.mobile };
  const matches = await deps.customers.findByIdentity(input.organizationId, contact);
  const existingCustomer = pickCustomer(matches, contact);
  if (existingCustomer) {
    const existingCard = await deps.loyalty.list(input.organizationId, {
      customerId: existingCustomer.id,
      cardId: input.card.id,
      status: "active",
      limit: 1,
    });
    if (existingCard[0]) {
      return {
        issuedCard: existingCard[0].issuedCard,
        customer: existingCustomer,
        createdCustomer: false,
        createdCard: false,
      };
    }
  }

  assertCardIssuable(input.card, input.organizationId);
  if (!input.card.loyaltyJoinEnabled) {
    throw new LoyaltyUnavailableError("Las altas públicas están desactivadas para esta campaña.");
  }
  if (existingCustomer?.status === "inactive") {
    throw new LoyaltyUnavailableError("Este cliente está inactivo. Pide ayuda al negocio.");
  }
  if (existingCustomer) {
    assertContact(input.card, { email: existingCustomer.email, mobile: existingCustomer.mobile });
  } else {
    assertContact(input.card, contact);
  }

  let customer = existingCustomer;
  let createdCustomer = false;
  if (!customer) {
    try {
      customer = await deps.customers.create(input.organizationId, {
        name: parsed.data.name,
        email: parsed.data.email,
        mobile: parsed.data.mobile,
        status: "active",
      });
      createdCustomer = true;
    } catch (error) {
      if (!(error instanceof CustomerContactTakenError)) throw error;
      const retryMatches = await deps.customers.findByIdentity(input.organizationId, contact);
      customer = pickCustomer(retryMatches, contact);
      if (!customer) throw error;
    }
  }

  const issued = await issueCardForCustomer(deps, {
    organizationId: input.organizationId,
    card: input.card,
    customer,
    actor: input.actor,
    remarks: "Alta pública",
  });
  return { ...issued, customer, createdCustomer, createdCard: issued.created };
}

export async function findIssuedCard(
  deps: LoyaltyServiceDeps,
  organizationId: string,
  issuedCardId: string,
): Promise<IssuedCardRow> {
  const found = await deps.loyalty.findByIdRow(organizationId, issuedCardId);
  if (!found) throw new LoyaltyUnavailableError("Tarjeta emitida no encontrada.");
  return found;
}

export function customerInputFromForm(data: unknown) {
  return CustomerInputSchema.safeParse(data);
}


export async function addStampForIssuedCard(
  deps: LoyaltyServiceDeps,
  input: { organizationId: string; card: Card; issuedCardId: string; actor?: LoyaltyActor; remarks?: string | null },
): Promise<IssuedCard> {
  assertCardAvailable(input.card, input.organizationId);
  const row = await findIssuedCard(deps, input.organizationId, input.issuedCardId);
  if (row.card.id !== input.card.id) throw new LoyaltyUnavailableError("Tarjeta no encontrada.");
  return deps.loyalty.addStamp({
    organizationId: input.organizationId,
    issuedCardId: input.issuedCardId,
    maxStamps: input.card.stampsRequired,
    actor: input.actor,
    remarks: input.remarks,
  });
}

export async function removeStampForIssuedCard(
  deps: LoyaltyServiceDeps,
  input: { organizationId: string; card: Card; issuedCardId: string; actor?: LoyaltyActor; remarks?: string | null },
): Promise<IssuedCard> {
  assertCardAvailable(input.card, input.organizationId);
  const row = await findIssuedCard(deps, input.organizationId, input.issuedCardId);
  if (row.card.id !== input.card.id) throw new LoyaltyUnavailableError("Tarjeta no encontrada.");
  return deps.loyalty.removeStamp({
    organizationId: input.organizationId,
    issuedCardId: input.issuedCardId,
    actor: input.actor,
    remarks: input.remarks,
  });
}

export async function redeemIssuedCard(
  deps: LoyaltyServiceDeps,
  input: { organizationId: string; card: Card; issuedCardId: string; actor?: LoyaltyActor; remarks?: string | null },
): Promise<IssuedCard> {
  assertCardAvailable(input.card, input.organizationId);
  const row = await findIssuedCard(deps, input.organizationId, input.issuedCardId);
  if (row.card.id !== input.card.id) throw new LoyaltyUnavailableError("Tarjeta no encontrada.");
  return deps.loyalty.redeem({
    organizationId: input.organizationId,
    issuedCardId: input.issuedCardId,
    requiredStamps: input.card.stampsRequired,
    actor: input.actor,
    remarks: input.remarks,
  });
}

export async function revokeIssuedCard(
  deps: LoyaltyServiceDeps,
  input: { organizationId: string; card: Card; issuedCardId: string; actor?: LoyaltyActor; remarks?: string | null },
): Promise<IssuedCard> {
  assertCardAvailable(input.card, input.organizationId);
  const row = await findIssuedCard(deps, input.organizationId, input.issuedCardId);
  if (row.card.id !== input.card.id) throw new LoyaltyUnavailableError("Tarjeta no encontrada.");
  return deps.loyalty.revoke({
    organizationId: input.organizationId,
    issuedCardId: input.issuedCardId,
    actor: input.actor,
    remarks: input.remarks,
  });
}
