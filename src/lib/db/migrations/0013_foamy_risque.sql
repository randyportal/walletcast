ALTER TABLE "cards" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ALTER COLUMN "organization_id" SET NOT NULL;