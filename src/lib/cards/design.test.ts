import { describe, expect, it } from "vitest";
import { CardInputSchema } from "./validation";
import {
  cardBackgroundStyle,
  cardUsesHero,
  contrastRatio,
  hexToRgba,
  isHeroBackground,
  LinksSchema,
} from "./design";
import { fontStack, FONT_STACKS } from "./fonts";
import { APPLE_BARCODE_FORMATS, GOOGLE_BARCODE_TYPES, resolveBarcode } from "./barcode";
import { faviconIcons, faviconUrl } from "./favicon";

const base = { name: "Lu's Café", organizationName: "Lu", slug: "lus-cafe" };

describe("card design validation", () => {
  it("defaults the design fields", () => {
    const parsed = CardInputSchema.parse(base);
    expect(parsed).toMatchObject({
      backgroundType: "solid",
      bgColor2: null,
      gradientAngle: 135,
      backgroundOverlay: 35,
      accentColor: "#4f46e5",
      fontFamily: "sans",
      iconSource: "auto",
      iconPreset: "",
      iconShape: "rounded",
      monogramText: "",
      barcodeType: "qr",
      barcodeContent: "link",
      barcodeValue: null,
      links: [],
      customFields: [],
    });
  });

  it("requires a second color for gradients", () => {
    expect(CardInputSchema.safeParse({ ...base, backgroundType: "linear" }).success).toBe(false);
    expect(CardInputSchema.safeParse({ ...base, backgroundType: "linear", bgColor2: "#1f2937" }).success).toBe(true);
  });

  it("parses links and custom fields from JSON strings", () => {
    const parsed = CardInputSchema.parse({
      ...base,
      links: JSON.stringify([{ id: "l1", label: "Menu", url: "https://menu.example", icon: "bag", style: "primary" }]),
      customFields: JSON.stringify([{ id: "f1", label: "Phone", value: "555", location: "front" }]),
    });
    expect(parsed.links).toHaveLength(1);
    expect(parsed.customFields[0].location).toBe("front");
  });

  it("rejects bad links and too many front fields", () => {
    expect(LinksSchema.safeParse(JSON.stringify([{ id: "a", label: "X", url: "javascript:alert(1)", icon: "link", style: "primary" }])).success).toBe(false);
    const fields = Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, label: `L${i}`, value: "v", location: "front" }));
    expect(CardInputSchema.safeParse({ ...base, customFields: JSON.stringify(fields) }).success).toBe(false);
  });

  it("validates barcode content", () => {
    expect(CardInputSchema.safeParse({ ...base, barcode: "on", barcodeContent: "custom" }).success).toBe(false);
    expect(CardInputSchema.safeParse({ ...base, barcode: "on", barcodeContent: "custom", barcodeValue: "HELLO" }).success).toBe(true);
    expect(
      CardInputSchema.safeParse({ ...base, barcode: "on", barcodeType: "code128", barcodeContent: "custom", barcodeValue: "café ☕" }).success,
    ).toBe(false);
  });
});

describe("design helpers", () => {
  it("builds background styles", () => {
    expect(cardBackgroundStyle({ backgroundType: "solid", bgColor: "#000000", bgColor2: null, gradientAngle: 135, backgroundOverlay: 35, backgroundOverlayColor: "#ffffff", backgroundPosition: "center" })).toEqual({ backgroundColor: "#000000" });
    const linear = cardBackgroundStyle({ backgroundType: "linear", bgColor: "#000000", bgColor2: "#ffffff", gradientAngle: 90, backgroundOverlay: 35, backgroundOverlayColor: "#000000", backgroundPosition: "center" });
    expect(linear.backgroundImage).toContain("linear-gradient(90deg");
    const image = cardBackgroundStyle({ backgroundType: "image", bgColor: "#000000", bgColor2: null, gradientAngle: 135, backgroundOverlay: 50, backgroundOverlayColor: "#000000", backgroundPosition: "top", backgroundImageUrl: "https://x/y.png" });
    expect(image.backgroundImage).toContain("url(");
    expect(image.backgroundPosition).toBe("top");
  });

  it("detects hero backgrounds", () => {
    expect(isHeroBackground("solid")).toBe(false);
    expect(isHeroBackground("linear")).toBe(true);
    expect(cardUsesHero({ dayGlow: true, backgroundType: "solid" })).toBe(true);
    expect(cardUsesHero({ dayGlow: false, backgroundType: "image" })).toBe(true);
  });

  it("computes contrast and rgba", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(hexToRgba("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });

  it("maps font families", () => {
    expect(fontStack("serif")).toBe(FONT_STACKS.serif);
    expect(fontStack("unknown")).toBe(FONT_STACKS.sans);
  });
});

describe("barcode", () => {
  const card = { barcode: true, barcodeType: "qr", barcodeContent: "link", barcodeValue: null, slug: "lu", websiteUrl: "https://lu.example" };

  it("resolves content for each mode", () => {
    expect(resolveBarcode(card, "https://wc.test")).toEqual({ format: "qr", value: "https://wc.test/c/lu?src=pass" });
    expect(resolveBarcode({ ...card, barcodeContent: "website" }, "https://wc.test")).toEqual({ format: "qr", value: "https://lu.example" });
    expect(resolveBarcode({ ...card, barcodeContent: "custom", barcodeValue: "TXT" }, "https://wc.test")).toEqual({ format: "qr", value: "TXT" });
    expect(resolveBarcode({ ...card, barcode: false }, "https://wc.test")).toBeNull();
  });

  it("maps platform formats", () => {
    expect(APPLE_BARCODE_FORMATS.pdf417).toBe("PKBarcodeFormatPDF417");
    expect(GOOGLE_BARCODE_TYPES.code128).toBe("CODE_128");
  });
});

describe("favicon", () => {
  it("builds versioned favicon URLs and icons", () => {
    const card = { id: "id-1", updatedAt: new Date(1000) };
    expect(faviconUrl(card)).toBe("/api/cards/id-1/image/favicon?v=1000");
    expect(faviconIcons(card).apple[0].sizes).toBe("180x180");
  });
});
