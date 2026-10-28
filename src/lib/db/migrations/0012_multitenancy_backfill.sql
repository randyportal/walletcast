INSERT INTO "organizations" ("id", "name", "slug", "currency", "time_zone", "locale")
VALUES ('00000000-0000-0000-0000-000000000001', 'Travel Portal', 'travel-portal', 'MXN', 'America/Mexico_City', 'es')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "cards" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "subscribers" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "messages" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
--> statement-breakpoint
INSERT INTO "organization_memberships" ("organization_id", "user_id", "role")
SELECT '00000000-0000-0000-0000-000000000001', "id", CASE WHEN "role" = 'admin' THEN 'owner' ELSE 'marketing' END
FROM "users"
ON CONFLICT ("organization_id", "user_id") DO NOTHING;
--> statement-breakpoint
UPDATE "users" SET "is_platform_admin" = true WHERE "role" = 'admin';
