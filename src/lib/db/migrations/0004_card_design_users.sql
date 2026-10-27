CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'marketing' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "background_type" text DEFAULT 'solid' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "bg_color2" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gradient_angle" integer DEFAULT 135 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "background_image" "bytea";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "background_overlay" integer DEFAULT 35 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "background_overlay_color" text DEFAULT '#000000' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "background_position" text DEFAULT 'center' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "accent_color" text DEFAULT '#4f46e5' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "font_family" text DEFAULT 'sans' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "icon_source" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "icon_preset" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "icon_shape" text DEFAULT 'rounded' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "monogram_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "favicon" "bytea";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "custom_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "barcode_type" text DEFAULT 'qr' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "barcode_content" text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "barcode_value" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sent_by" text;