import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  customers,
  issuedCards,
  type Customer,
  type CustomerStatus,
} from "@/lib/db/schema";
import type { CustomerInput } from "./validation";

export class CustomerContactTakenError extends Error {
  constructor() {
    super("Ese correo o móvil ya pertenece a otro cliente");
    this.name = "CustomerContactTakenError";
  }
}

export interface CustomerWithCardCount extends Customer {
  activeCards: number;
}

export interface CustomerListOptions {
  search?: string;
  status?: CustomerStatus;
  limit?: number;
  offset?: number;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export function createCustomerRepository(db: Db) {
  return {
    async create(organizationId: string, input: CustomerInput): Promise<Customer> {
      try {
        const [row] = await db
          .insert(customers)
          .values({ organizationId, ...input })
          .returning();
        return row;
      } catch (error) {
        if (isUniqueViolation(error)) throw new CustomerContactTakenError();
        throw error;
      }
    },

    async update(organizationId: string, id: string, input: CustomerInput): Promise<Customer | null> {
      try {
        const [row] = await db
          .update(customers)
          .set({ ...input, updatedAt: new Date() })
          .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
          .returning();
        return row ?? null;
      } catch (error) {
        if (isUniqueViolation(error)) throw new CustomerContactTakenError();
        throw error;
      }
    },

    async findById(organizationId: string, id: string): Promise<Customer | null> {
      const [row] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
      return row ?? null;
    },

    async findByIdentity(
      organizationId: string,
      contact: { email: string | null; mobile: string | null },
    ): Promise<Customer[]> {
      const matches = [];
      if (contact.email) matches.push(eq(customers.email, contact.email));
      if (contact.mobile) matches.push(eq(customers.mobile, contact.mobile));
      if (matches.length === 0) return [];
      return db
        .select()
        .from(customers)
        .where(and(eq(customers.organizationId, organizationId), or(...matches)))
        .orderBy(customers.createdAt);
    },

    async list(organizationId: string, options: CustomerListOptions = {}): Promise<CustomerWithCardCount[]> {
      const conditions = [eq(customers.organizationId, organizationId)];
      if (options.status) conditions.push(eq(customers.status, options.status));
      if (options.search) {
        const query = `%${options.search}%`;
        conditions.push(or(ilike(customers.name, query), ilike(customers.email, query), ilike(customers.mobile, query))!);
      }
      const rows = await db
        .select({ customer: customers, activeCards: count(issuedCards.id) })
        .from(customers)
        .leftJoin(
          issuedCards,
          and(eq(issuedCards.customerId, customers.id), eq(issuedCards.status, "active")),
        )
        .where(and(...conditions))
        .groupBy(customers.id)
        .orderBy(desc(customers.createdAt))
        .limit(options.limit ?? 100)
        .offset(options.offset ?? 0);
      return rows.map((row) => ({ ...row.customer, activeCards: row.activeCards }));
    },

    async count(organizationId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(customers)
        .where(eq(customers.organizationId, organizationId));
      return row?.n ?? 0;
    },
  };
}

export type CustomerRepository = ReturnType<typeof createCustomerRepository>;
