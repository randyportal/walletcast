import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createTestDb } from "@/lib/testing/db";
import { createCardRepository } from "@/lib/cards/repository";
import { CardInputSchema } from "@/lib/cards/validation";
import { generateDefaultIcon, processBackgroundUpload, processFaviconUpload, renderCardHero, renderCardIcon, renderCardStrips, renderCustomLinkIcon, renderLinkIcon } from "./images";

async function pngFile(w: number, h: number, type = "image/png"): Promise<File> {
  const buf = await sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "a.png", { type });
}

async function card(over: Record<string, unknown> = {}, images: Parameters<ReturnType<typeof createCardRepository>["create"]>[1] = {}) {
  const db = await createTestDb();
  const repo = createCardRepository(db);
  return repo.create(CardInputSchema.parse({ name: "Lu's Café", organizationName: "Lu", slug: "lus-cafe", ...over }), images);
}

describe("image processing", () => {
  it("resizes and compresses background uploads", async () => {
    const out = await processBackgroundUpload(await pngFile(1000, 1000));
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.height).toBe(900);
  });

  it("resizes favicon uploads to 180x180", async () => {
    const out = await processFaviconUpload(await pngFile(500, 200));
    expect((await sharp(out!).metadata()).width).toBe(180);
  });

  it("generates a monogram icon when no preset or upload is set", async () => {
    const c = await card();
    const icon = await renderCardIcon(c);
    expect((await sharp(icon).metadata()).width).toBe(87);
  });

  it("renders a preset icon with a shape", async () => {
    const c = await card({ iconSource: "preset", iconPreset: "star", iconShape: "circle", bgColor: "#000000", fgColor: "#ffffff" });
    const icon = await renderCardIcon(c);
    expect((await sharp(icon).metadata()).width).toBe(87);
  });

  it("renders recommendation icons with an opaque background", async () => {
    const png = await renderLinkIcon("star", "#ebc400", "#000000");
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2], data[3]]).toEqual([235, 196, 0, 255]);
  });

  it("flattens uploaded icons onto the recommendation background", async () => {
    const transparent = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const png = await renderCustomLinkIcon(transparent, "#112233");
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2], data[3]]).toEqual([17, 34, 51, 255]);
  });

  it("keeps the default icon helper working", async () => {
    const icon = await generateDefaultIcon("Lu", "#000000", "#ffffff");
    expect((await sharp(icon).metadata()).width).toBe(87);
  });
});

describe("strip and hero rendering", () => {
  it("renders gradient strips", async () => {
    const c = await card({ backgroundType: "linear", bgColor: "#000000", bgColor2: "#ffffff" });
    const strips = await renderCardStrips(c, 0.5);
    expect(Object.keys(strips)).toEqual(expect.arrayContaining(["strip.png", "strip@2x.png", "strip@3x.png"]));
    expect((await sharp(strips["strip.png"]).metadata()).width).toBe(375);
  });

  it("renders image strips with an overlay", async () => {
    const c = await card({ backgroundType: "image", backgroundOverlay: 40 }, { background: await processBackgroundUpload(await pngFile(800, 800)) });
    const strips = await renderCardStrips(c, 0.5);
    expect((await sharp(strips["strip@3x.png"]).metadata()).width).toBe(1125);
  });

  it("renders a Google hero image", async () => {
    const c = await card({ backgroundType: "radial", bgColor: "#111111", bgColor2: "#444444" });
    const hero = await renderCardHero(c, 0.5);
    expect((await sharp(hero!).metadata()).width).toBe(1032);
  });
});
