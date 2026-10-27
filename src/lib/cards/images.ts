import sharp, { type OverlayOptions } from "sharp";
import type { Card } from "@/lib/db/schema";
import { type IconPreset, type IconShape } from "./design";
import { ICON_PATHS } from "./icon-paths";
import { renderStrips } from "@/lib/glow/strip";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_BACKGROUND_BYTES = 6 * 1024 * 1024;
export const MAX_FAVICON_BYTES = 1 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}

const SHARP_OPTIONS = { limitInputPixels: 25_000_000 };

export const LOGO_MASTER = { width: 480, height: 150 };
export const ICON_MASTER = { width: 87, height: 87 };
export const BACKGROUND_MASTER = { width: 1600, height: 900 };
export const FAVICON_MASTER = { width: 180, height: 180 };
export const HERO_MASTER = { width: 1032, height: 336 };

const STRIP_SIZES = [
  { file: "strip.png", width: 375, height: 123 },
  { file: "strip@2x.png", width: 750, height: 246 },
  { file: "strip@3x.png", width: 1125, height: 369 },
];

async function readUpload(file: File, maxBytes: number): Promise<Buffer> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new ImageUploadError("Upload a PNG, JPEG or WebP image");
  if (file.size > maxBytes) throw new ImageUploadError(`Images must be ${Math.round(maxBytes / 1024 / 1024)} MB or less`);
  return Buffer.from(await file.arrayBuffer());
}

export async function processLogoUpload(file: File | null): Promise<Buffer | undefined> {
  if (!file || file.size === 0) return undefined;
  const input = await readUpload(file, MAX_UPLOAD_BYTES);
  try {
    return await sharp(input, SHARP_OPTIONS)
      .resize({ ...LOGO_MASTER, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new ImageUploadError("This image could not be read");
  }
}

export async function processIconUpload(file: File | null): Promise<Buffer | undefined> {
  if (!file || file.size === 0) return undefined;
  const input = await readUpload(file, MAX_UPLOAD_BYTES);
  try {
    return await sharp(input, SHARP_OPTIONS).resize({ ...ICON_MASTER, fit: "cover" }).png().toBuffer();
  } catch {
    throw new ImageUploadError("This image could not be read");
  }
}

export async function processBackgroundUpload(file: File | null): Promise<Buffer | undefined> {
  if (!file || file.size === 0) return undefined;
  const input = await readUpload(file, MAX_BACKGROUND_BYTES);
  try {
    return await sharp(input, SHARP_OPTIONS)
      .resize({ ...BACKGROUND_MASTER, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageUploadError("This image could not be read");
  }
}

export async function processFaviconUpload(file: File | null): Promise<Buffer | undefined> {
  if (!file || file.size === 0) return undefined;
  const input = await readUpload(file, MAX_FAVICON_BYTES);
  try {
    return await sharp(input, SHARP_OPTIONS)
      .resize({ ...FAVICON_MASTER, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    throw new ImageUploadError("This image could not be read");
  }
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const ICON_GLYPHS = ICON_PATHS;

function shapeRadius(shape: IconShape): number {
  return shape === "rounded" ? 36 : shape === "circle" ? 87 : 0;
}

function monogramSvg(text: string, bg: string, fg: string, shape: IconShape): Buffer {
  const rx = shapeRadius(shape);
  const letter = escapeXml(text.toUpperCase());
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="174" height="174">
      <rect width="174" height="174" rx="${rx}" fill="${bg}"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="96" fill="${fg}">${letter}</text>
    </svg>`,
  );
}

function glyphSvg(preset: IconPreset, bg: string, fg: string, shape: IconShape): Buffer {
  const rx = shapeRadius(shape);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="174" height="174">
      <rect width="174" height="174" rx="${rx}" fill="${bg}"/>
      <g transform="translate(39 39) scale(4)" fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_GLYPHS[preset]}</g>
    </svg>`,
  );
}

export async function generateDefaultIcon(name: string, bgColor: string, fgColor: string): Promise<Buffer> {
  const letter = (name.trim()[0] ?? "W").toUpperCase();
  return sharp(monogramSvg(letter, bgColor, fgColor, "rounded")).resize(ICON_MASTER.width, ICON_MASTER.height).png().toBuffer();
}

export async function renderCardIcon(card: Pick<Card, "name" | "bgColor" | "fgColor" | "icon" | "iconSource" | "iconPreset" | "iconShape" | "monogramText">, size = ICON_MASTER.width): Promise<Buffer> {
  const uploaded = card.icon;
  const preset = card.iconPreset && card.iconPreset !== "" ? (card.iconPreset as IconPreset) : null;
  const monogram = (card.monogramText.trim() || (card.name.trim()[0] ?? "W")).slice(0, 2);

  if (card.iconSource === "auto" && uploaded) {
    return resizePng(uploaded, size, size, "cover");
  }
  if (card.iconSource === "preset" && preset) {
    return sharp(glyphSvg(preset, card.bgColor, card.fgColor, card.iconShape as IconShape), SHARP_OPTIONS).resize(size, size).png().toBuffer();
  }
  if (card.iconSource === "auto" && preset) {
    return sharp(glyphSvg(preset, card.bgColor, card.fgColor, card.iconShape as IconShape), SHARP_OPTIONS).resize(size, size).png().toBuffer();
  }
  return sharp(monogramSvg(monogram, card.bgColor, card.fgColor, card.iconShape as IconShape), SHARP_OPTIONS).resize(size, size).png().toBuffer();
}

export async function resizePng(input: Buffer, width: number, height: number, fit: "inside" | "cover"): Promise<Buffer> {
  return sharp(input, SHARP_OPTIONS).resize({ width, height, fit }).png().toBuffer();
}

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function sharpPosition(position: string): string {
  return position === "center" ? "centre" : position;
}

function gradientSvg(card: Pick<Card, "backgroundType" | "bgColor" | "bgColor2" | "gradientAngle">, width: number, height: number): Buffer {
  const second = card.bgColor2 ?? card.bgColor;
  if (card.backgroundType === "radial") {
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs><radialGradient id="g" cx="50%" cy="0%" r="140%"><stop offset="0" stop-color="${card.bgColor}"/><stop offset="1" stop-color="${second}"/></radialGradient></defs>
        <rect width="${width}" height="${height}" fill="url(#g)"/>
      </svg>`,
    );
  }
  const angle = ((card.gradientAngle - 90) * Math.PI) / 180;
  const x = 50 + Math.cos(angle) * 50;
  const y = 50 + Math.sin(angle) * 50;
  const x2 = 50 - Math.cos(angle) * 50;
  const y2 = 50 - Math.sin(angle) * 50;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><linearGradient id="g" x1="${x}%" y1="${y}%" x2="${x2}%" y2="${y2}%"><stop offset="0" stop-color="${card.bgColor}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
    </svg>`,
  );
}

async function imageDesign(
  card: Pick<Card, "backgroundImage" | "backgroundOverlay" | "backgroundOverlayColor" | "backgroundPosition" | "bgColor">,
  width: number,
  height: number,
  fade: boolean,
): Promise<Buffer> {
  const base = await sharp(card.backgroundImage!, SHARP_OPTIONS)
    .resize(width, height, { fit: "cover", position: sharpPosition(card.backgroundPosition) as string })
    .toBuffer();
  const overlay = hexRgb(card.backgroundOverlayColor);
  const alpha = Math.round(255 * (card.backgroundOverlay / 100));
  const composites: OverlayOptions[] = [];
  if (alpha > 0) {
    composites.push({
      input: Buffer.from([overlay.r, overlay.g, overlay.b, alpha]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
    });
  }
  if (fade) {
    const fadeSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${card.bgColor}" stop-opacity="0"/><stop offset="1" stop-color="${card.bgColor}" stop-opacity="1"/></linearGradient></defs>
        <rect width="${width}" height="${height}" fill="url(#f)"/>
      </svg>`,
    );
    composites.push({ input: fadeSvg });
  }
  return sharp(base).composite(composites).png().toBuffer();
}

export async function renderCardStrips(
  card: Pick<Card, "dayGlow" | "backgroundType" | "bgColor" | "bgColor2" | "gradientAngle" | "backgroundImage" | "backgroundOverlay" | "backgroundOverlayColor" | "backgroundPosition">,
  hue: number,
): Promise<Record<string, Buffer>> {
  if (card.dayGlow) return renderStrips(hue, card.bgColor);
  const entries = await Promise.all(
    STRIP_SIZES.map(async ({ file, width, height }) => {
      let png: Buffer;
      if (card.backgroundType === "image" && card.backgroundImage) {
        png = await imageDesign(card, width, height, true);
      } else {
        png = await sharp(gradientSvg(card, width, height), SHARP_OPTIONS).resize(width, height).png().toBuffer();
      }
      return [file, png] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function renderCardHero(
  card: Pick<Card, "dayGlow" | "backgroundType" | "bgColor" | "bgColor2" | "gradientAngle" | "backgroundImage" | "backgroundOverlay" | "backgroundOverlayColor" | "backgroundPosition">,
  hue: number,
): Promise<Buffer | null> {
  if (card.dayGlow) {
    const strips = await renderStrips(hue, card.bgColor);
    return sharp(strips["strip@3x.png"], SHARP_OPTIONS).resize(HERO_MASTER.width, HERO_MASTER.height, { fit: "cover" }).png().toBuffer();
  }
  if (card.backgroundType === "image" && card.backgroundImage) {
    return imageDesign(card, HERO_MASTER.width, HERO_MASTER.height, false);
  }
  if (card.backgroundType === "linear" || card.backgroundType === "radial") {
    return sharp(gradientSvg(card, HERO_MASTER.width, HERO_MASTER.height), SHARP_OPTIONS).resize(HERO_MASTER.width, HERO_MASTER.height).png().toBuffer();
  }
  return null;
}
