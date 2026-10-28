import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CardField, CardLink } from "@/lib/cards/design";
import { DEFAULT_GOOGLE_CONFIG, type GoogleConfig } from "@/lib/cards/google";
import { DEFAULT_APPLE_CONFIG, type AppleConfig } from "@/lib/cards/apple";
import { LEGACY_CONTENT_CONFIG, type ContentConfig } from "@/lib/cards/content";

/** Binary column (PNG images). PGlite returns Uint8Array, postgres-js Buffer: normalise to Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("MXN"),
  timeZone: text("time_zone").notNull().default("America/Mexico_City"),
  locale: text("locale").notNull().default("es"),
  ...timestamps,
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  organizationName: text("organization_name").notNull(),
  description: text("description").notNull().default(""),
  welcomeText: text("welcome_text").notNull().default(""),
  websiteUrl: text("website_url"),
  bgColor: text("bg_color").notNull().default("#111827"),
  fgColor: text("fg_color").notNull().default("#ffffff"),
  labelColor: text("label_color").notNull().default("#9ca3af"),
  logo: bytea("logo"),
  icon: bytea("icon"),
  latestMessage: text("latest_message"),
  latestMessageAt: timestamp("latest_message_at", { withTimezone: true }),
  barcode: boolean("barcode").notNull().default(false),
  latestLabel: text("latest_label").notNull().default("LATEST"),
  contactUrl: text("contact_url"),
  logoText: text("logo_text").notNull().default(""),
  headerLabel: text("header_label").notNull().default(""),
  headerValue: text("header_value").notNull().default(""),
  nameLabel: text("name_label").notNull().default(""),
  dayGlow: boolean("day_glow").notNull().default(false),
  glowSlot: integer("glow_slot"),
  backgroundType: text("background_type").notNull().default("solid"),
  bgColor2: text("bg_color2"),
  gradientAngle: integer("gradient_angle").notNull().default(135),
  backgroundImage: bytea("background_image"),
  backgroundOverlay: integer("background_overlay").notNull().default(35),
  backgroundOverlayColor: text("background_overlay_color").notNull().default("#000000"),
  backgroundPosition: text("background_position").notNull().default("center"),
  accentColor: text("accent_color").notNull().default("#4f46e5"),
  fontFamily: text("font_family").notNull().default("sans"),
  iconSource: text("icon_source").notNull().default("auto"),
  iconPreset: text("icon_preset").notNull().default(""),
  iconShape: text("icon_shape").notNull().default("rounded"),
  monogramText: text("monogram_text").notNull().default(""),
  favicon: bytea("favicon"),
  links: jsonb("links").$type<CardLink[]>().notNull().default([]),
  customFields: jsonb("custom_fields").$type<CardField[]>().notNull().default([]),
  barcodeType: text("barcode_type").notNull().default("qr"),
  barcodeContent: text("barcode_content").notNull().default("link"),
  barcodeValue: text("barcode_value"),
  googleConfig: jsonb("google_config").$type<GoogleConfig>().notNull().default(DEFAULT_GOOGLE_CONFIG),
  contentConfig: jsonb("content_config").$type<ContentConfig>().notNull().default(LEGACY_CONTENT_CONFIG),
  appleConfig: jsonb("apple_config").$type<AppleConfig>().notNull().default(DEFAULT_APPLE_CONFIG),
  appleImage: bytea("apple_image"),
  publicPageMode: text("public_page_mode").notNull().default("full"),
  askEmail: boolean("ask_email").notNull().default(true),
  emailRequired: boolean("email_required").notNull().default(false),
  ...timestamps,
});

export const cardAssets = pgTable(
  "card_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    mime: text("mime").notNull().default("image/png"),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("card_assets_card_idx").on(t.cardId)],
);

export const PLATFORMS = ["apple", "google"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    serialNumber: text("serial_number").notNull().unique(),
    authToken: text("auth_token").notNull(),
    email: text("email"),
    source: text("source"),
    status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
    ...timestamps,
  },
  (t) => [index("subscribers_card_idx").on(t.cardId, t.platform, t.status), index("subscribers_org_idx").on(t.organizationId)],
);

export const appleDevices = pgTable("apple_devices", {
  deviceLibraryId: text("device_library_id").primaryKey(),
  pushToken: text("push_token").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appleRegistrations = pgTable(
  "apple_registrations",
  {
    deviceLibraryId: text("device_library_id")
      .notNull()
      .references(() => appleDevices.deviceLibraryId, { onDelete: "cascade" }),
    serialNumber: text("serial_number")
      .notNull()
      .references(() => subscribers.serialNumber, { onDelete: "cascade" }),
    passTypeId: text("pass_type_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.deviceLibraryId, t.serialNumber] })],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    appleTargets: integer("apple_targets").notNull().default(0),
    appleSent: integer("apple_sent").notNull().default(0),
    appleFailed: integer("apple_failed").notNull().default(0),
    googleTargets: integer("google_targets").notNull().default(0),
    googleSent: integer("google_sent").notNull().default(0),
    googleFailed: integer("google_failed").notNull().default(0),
    sentBy: text("sent_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_card_idx").on(t.cardId, t.createdAt), index("messages_org_idx").on(t.organizationId)],
);

export const USER_ROLES = ["admin", "marketing"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORGANIZATION_ROLES = ["owner", "admin", "marketing", "staff", "viewer"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: USER_ROLES }).notNull().default("marketing"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ORGANIZATION_ROLES }).notNull().default("viewer"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("organization_memberships_org_user_unique").on(t.organizationId, t.userId),
    index("organization_memberships_user_idx").on(t.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ORGANIZATION_ROLES }).notNull().default("marketing"),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitations_org_idx").on(t.organizationId, t.email)],
);

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardAsset = typeof cardAssets.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
