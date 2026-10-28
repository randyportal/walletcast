import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/db/schema";
import { DEFAULT_CONTENT_CONFIG, normalizeContent, previousMessages, visibleRecommendations } from "./content";
import { effectiveGoogleCodeMode, DEFAULT_GOOGLE_CONFIG } from "./google";

const legacyCard = {
  websiteUrl: "https://example.com",
  contactUrl: "https://example.com/me.vcf",
  links: [
    {
      id: "l1",
      label: "Menú",
      url: "https://example.com/menu",
      icon: "bag" as const,
      style: "primary" as const,
      iconAssetId: null,
    },
  ],
  googleConfig: {
    ...DEFAULT_GOOGLE_CONFIG,
    valueModules: [
      {
        id: "m1",
        header: "Reservar",
        body: "Cita online",
        url: "https://example.com/book",
        imageKind: "preset" as const,
        icon: "calendar" as const,
        assetId: null,
      },
    ],
  },
  contentConfig: undefined,
} as unknown as Card;

describe("card content", () => {
  it("migrates legacy links, value modules, website and contact", () => {
    const content = normalizeContent(legacyCard);
    expect(content.config.version).toBe(2);
    expect(content.links.map((link) => link.id)).toEqual(["l1", "vm_m1", "website", "contact"]);
    expect(content.links[0]).toMatchObject({ subtitle: "", kind: "custom", visible: true });
    expect(content.links[1]).toMatchObject({ label: "Reservar", subtitle: "Cita online", kind: "custom" });
    expect(content.links[2]).toMatchObject({ label: "Sitio web", kind: "website", url: "https://example.com" });
    expect(content.links[3]).toMatchObject({ label: "Guardar contacto", kind: "contact" });
  });

  it("does not re-add website/contact for version 2 cards", () => {
    const content = normalizeContent({
      ...legacyCard,
      contentConfig: { ...DEFAULT_CONTENT_CONFIG, latest: { ...DEFAULT_CONTENT_CONFIG.latest }, recommendations: { show: true, title: "Nuestros servicios" } },
      links: [],
      googleConfig: { ...DEFAULT_GOOGLE_CONFIG, valueModules: [] },
    });
    expect(content.links).toEqual([]);
    expect(content.config.recommendations.title).toBe("Nuestros servicios");
  });

  it("filters hidden recommendations and excludes the latest message from history", () => {
    const content = normalizeContent({
      ...legacyCard,
      contentConfig: DEFAULT_CONTENT_CONFIG,
      links: [
        { ...legacyCard.links[0], visible: true },
        { ...legacyCard.links[0], id: "l2", label: "Oculta", visible: false },
      ],
      googleConfig: { ...DEFAULT_GOOGLE_CONFIG, valueModules: [] },
    });
    expect(visibleRecommendations(content.links).map((link) => link.id)).toEqual(["l1"]);
    const messages = [
      { title: "Nuevo", body: "Mensaje", createdAt: new Date("2026-10-10T10:00:00Z") },
      { title: "Viejo", body: "Anterior", createdAt: new Date("2026-10-09T10:00:00Z") },
    ];
    expect(previousMessages(messages, "Nuevo: Mensaje")).toEqual([messages[1]]);
  });

  it("makes the card QR switch override Google's code mode", () => {
    expect(effectiveGoogleCodeMode({ barcode: false, googleConfig: { ...DEFAULT_GOOGLE_CONFIG, code: { mode: "code", text: "" } } })).toBe("hidden");
    expect(effectiveGoogleCodeMode({ barcode: false, googleConfig: { ...DEFAULT_GOOGLE_CONFIG, code: { mode: "text", text: "SOCIO" } } })).toBe("text");
    expect(effectiveGoogleCodeMode({ barcode: true, googleConfig: DEFAULT_GOOGLE_CONFIG })).toBe("code");
  });
});
