CREATE TABLE "card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"issued_card_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"actor_user_id" uuid,
	"actor_name" text,
	"actor_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"mobile" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issued_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"stamps" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"last_visit_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issued_cards_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "loyalty_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "stamps_required" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "reward_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "loyalty_join_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "join_contact_policy" text DEFAULT 'optional' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "notify_on_stamp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "notify_on_reward" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "notify_on_redeem" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "issued_card_id" uuid;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_issued_card_id_issued_cards_id_fk" FOREIGN KEY ("issued_card_id") REFERENCES "public"."issued_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_cards" ADD CONSTRAINT "issued_cards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_cards" ADD CONSTRAINT "issued_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_cards" ADD CONSTRAINT "issued_cards_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_transactions_org_idx" ON "card_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "card_transactions_card_idx" ON "card_transactions" USING btree ("issued_card_id","created_at");--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_email_unique" ON "customers" USING btree ("organization_id","email") WHERE "customers"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_mobile_unique" ON "customers" USING btree ("organization_id","mobile") WHERE "customers"."mobile" is not null;--> statement-breakpoint
CREATE INDEX "issued_cards_org_idx" ON "issued_cards" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "issued_cards_customer_idx" ON "issued_cards" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "issued_cards_card_idx" ON "issued_cards" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issued_cards_active_unique" ON "issued_cards" USING btree ("customer_id","card_id") WHERE "issued_cards"."status" = 'active';--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_issued_card_id_issued_cards_id_fk" FOREIGN KEY ("issued_card_id") REFERENCES "public"."issued_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscribers_issued_card_idx" ON "subscribers" USING btree ("issued_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_issued_card_platform_unique" ON "subscribers" USING btree ("issued_card_id","platform") WHERE "subscribers"."issued_card_id" is not null;