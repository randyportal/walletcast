CREATE TABLE "card_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mime" text DEFAULT 'image/png' NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "google_config" jsonb DEFAULT '{"type":"auto","button":null,"code":{"mode":"auto","text":""},"showLatest":true,"showDescription":true,"showCustomFields":true,"textModules":[],"valueModules":[],"imageModule":null}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "public_page_mode" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "ask_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "card_assets" ADD CONSTRAINT "card_assets_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_assets_card_idx" ON "card_assets" USING btree ("card_id");