"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { FormState } from "@/server/actions";
import { slugify } from "@/lib/cards/validation";
import {
  BARCODE_CONTENTS,
  BARCODE_TYPES,
  contrastRatio,
  FONT_FAMILIES,
  ICON_PRESETS,
  ICON_SHAPES,
  LINK_ICONS,
  LINK_STYLES,
  type CardField,
  type CardLink,
} from "@/lib/cards/design";
import { ICON_PATHS } from "@/lib/cards/icon-paths";
import { PassPreview } from "./PassPreview";
import { Glyph } from "./icons";

export interface CardFormValues {
  name: string;
  organizationName: string;
  slug: string;
  description: string;
  welcomeText: string;
  websiteUrl: string;
  bgColor: string;
  fgColor: string;
  labelColor: string;
  accentColor: string;
  backgroundType: string;
  bgColor2: string;
  gradientAngle: number;
  backgroundOverlay: number;
  backgroundOverlayColor: string;
  backgroundPosition: string;
  fontFamily: string;
  iconSource: string;
  iconPreset: string;
  iconShape: string;
  monogramText: string;
  latestLabel: string;
  contactUrl: string;
  logoText: string;
  headerLabel: string;
  headerValue: string;
  nameLabel: string;
  barcode: boolean;
  barcodeType: string;
  barcodeContent: string;
  barcodeValue: string;
  dayGlow: boolean;
  links: CardLink[];
  customFields: CardField[];
}

const DEFAULTS: CardFormValues = {
  name: "",
  organizationName: "",
  slug: "",
  description: "",
  welcomeText: "Thanks for adding our card! We'll keep you posted here.",
  websiteUrl: "",
  bgColor: "#111827",
  fgColor: "#ffffff",
  labelColor: "#9ca3af",
  accentColor: "#4f46e5",
  backgroundType: "solid",
  bgColor2: "",
  gradientAngle: 135,
  backgroundOverlay: 35,
  backgroundOverlayColor: "#000000",
  backgroundPosition: "center",
  fontFamily: "sans",
  iconSource: "auto",
  iconPreset: "",
  iconShape: "rounded",
  monogramText: "",
  latestLabel: "LATEST",
  contactUrl: "",
  logoText: "",
  headerLabel: "",
  headerValue: "",
  nameLabel: "",
  barcode: false,
  barcodeType: "qr",
  barcodeContent: "link",
  barcodeValue: "",
  dayGlow: false,
  links: [],
  customFields: [],
};

const PRESETS: { name: string; patch: Partial<CardFormValues> }[] = [
  { name: "Midnight", patch: { backgroundType: "linear", bgColor: "#0c0c0d", bgColor2: "#1f2937", fgColor: "#f4f2ee", labelColor: "#8d8a84", accentColor: "#6d28d9", fontFamily: "sans" } },
  { name: "Sunset", patch: { backgroundType: "linear", bgColor: "#f97316", bgColor2: "#db2777", fgColor: "#ffffff", labelColor: "#fde68a", accentColor: "#7c3aed", fontFamily: "rounded" } },
  { name: "Ocean", patch: { backgroundType: "linear", bgColor: "#0ea5e9", bgColor2: "#1e3a8a", fgColor: "#ffffff", labelColor: "#bae6fd", accentColor: "#0f766e", fontFamily: "sans" } },
  { name: "Forest", patch: { backgroundType: "linear", bgColor: "#065f46", bgColor2: "#22c55e", fgColor: "#ffffff", labelColor: "#bbf7d0", accentColor: "#ca8a04", fontFamily: "serif" } },
  { name: "Candy", patch: { backgroundType: "linear", bgColor: "#f472b6", bgColor2: "#a855f7", fgColor: "#ffffff", labelColor: "#fce7f3", accentColor: "#db2777", fontFamily: "rounded" } },
  { name: "Gold", patch: { backgroundType: "linear", bgColor: "#1c1917", bgColor2: "#b45309", fgColor: "#fef3c7", labelColor: "#d6b46a", accentColor: "#d97706", fontFamily: "serif" } },
  { name: "Mono", patch: { backgroundType: "solid", bgColor: "#111827", fgColor: "#f9fafb", labelColor: "#9ca3af", accentColor: "#22d3ee", fontFamily: "mono" } },
  { name: "Aurora", patch: { backgroundType: "radial", bgColor: "#4c1d95", bgColor2: "#0f766e", fgColor: "#ffffff", labelColor: "#a5f3fc", accentColor: "#f43f5e", fontFamily: "sans" } },
];

const FONT_LABELS: Record<string, string> = {
  sans: "Sans",
  serif: "Serif",
  rounded: "Rounded",
  mono: "Mono",
  condensed: "Condensed",
};

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: Partial<CardFormValues>;
  existingLogoUrl?: string | null;
  existingIconUrl?: string | null;
  existingBackgroundUrl?: string | null;
  existingFaviconUrl?: string | null;
  latestMessage?: string | null;
  qrUrl?: string;
  glowHue: number;
  submitLabel: string;
}

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" name={name} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono text-xs" maxLength={7} />
      </div>
    </label>
  );
}

export function CardForm(props: Props) {
  const { action, initial, existingLogoUrl, existingIconUrl, existingBackgroundUrl, existingFaviconUrl, latestMessage, qrUrl, glowHue, submitLabel } = props;
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<CardFormValues>({ ...DEFAULTS, ...initial });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const logoPreview = useObjectUrl(logoFile);
  const iconPreview = useObjectUrl(iconFile);
  const backgroundPreview = useObjectUrl(backgroundFile);
  const faviconPreview = useObjectUrl(faviconFile);

  const update = (patch: Partial<CardFormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  const set = (key: keyof CardFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    update({ [key]: value } as Partial<CardFormValues>);
    if (key === "name" && !slugTouched) {
      setValues((prev) => ({ ...prev, slug: slugify(value) }));
    }
  };

  const err = (key: string) => (state.fieldErrors?.[key] ? <p className="mt-1 text-xs text-danger">{state.fieldErrors[key]}</p> : null);

  const isGradient = values.backgroundType === "linear" || values.backgroundType === "radial";
  const isImage = values.backgroundType === "image";
  const lowContrast = contrastRatio(values.fgColor, values.bgColor) < 4.5;

  const addLink = () => update({ links: [...values.links, { id: uid(), label: "", url: "https://", icon: "link", style: "secondary" }] });
  const patchLink = (id: string, patch: Partial<CardLink>) => update({ links: values.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const removeLink = (id: string) => update({ links: values.links.filter((l) => l.id !== id) });
  const moveLink = (id: string, dir: -1 | 1) => {
    const idx = values.links.findIndex((l) => l.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= values.links.length) return;
    const links = [...values.links];
    [links[idx], links[next]] = [links[next], links[idx]];
    update({ links });
  };

  const addField = () => update({ customFields: [...values.customFields, { id: uid(), label: "", value: "", location: "back" }] });
  const patchField = (id: string, patch: Partial<CardField>) => update({ customFields: values.customFields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeField = (id: string) => update({ customFields: values.customFields.filter((f) => f.id !== id) });

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5">
        <details className="panel" open>
          <summary className="cursor-pointer text-sm font-semibold">Card details</summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Business name</span>
                <input name="organizationName" className="input" required maxLength={60} value={values.organizationName} onChange={set("organizationName")} />
                {err("organizationName")}
              </label>
              <label className="block">
                <span className="field-label">Card name</span>
                <input name="name" className="input" required maxLength={60} value={values.name} onChange={set("name")} placeholder="VIP Club" />
                {err("name")}
              </label>
            </div>
            <label className="block">
              <span className="field-label">Public link</span>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted">/c/</span>
                <input name="slug" className="input" required maxLength={48} value={values.slug} onChange={(e) => { setSlugTouched(true); set("slug")(e); }} />
              </div>
              {err("slug")}
            </label>
            <label className="block">
              <span className="field-label">Message shown when the card is added</span>
              <input name="welcomeText" className="input" maxLength={200} value={values.welcomeText} onChange={set("welcomeText")} />
              <p className="field-hint">Replaced by your latest broadcast once you send one.</p>
            </label>
            <label className="block">
              <span className="field-label">Description (back of the card)</span>
              <textarea name="description" className="input min-h-20" maxLength={500} value={values.description} onChange={set("description")} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Website</span>
                <input name="websiteUrl" type="url" className="input" placeholder="https://" value={values.websiteUrl} onChange={set("websiteUrl")} />
                {err("websiteUrl")}
              </label>
              <label className="block">
                <span className="field-label">Contact file (vCard link)</span>
                <input name="contactUrl" type="url" className="input" placeholder="https://" value={values.contactUrl} onChange={set("contactUrl")} />
                {err("contactUrl")}
              </label>
            </div>
            <label className="block">
              <span className="field-label">Label of the latest message</span>
              <input name="latestLabel" className="input" maxLength={12} value={values.latestLabel} onChange={set("latestLabel")} />
              {err("latestLabel")}
            </label>
          </div>
        </details>

        <details className="panel" open>
          <summary className="cursor-pointer text-sm font-semibold">Design</summary>
          <div className="mt-4 space-y-4">
            <div>
              <span className="field-label">Presets</span>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="btn-secondary px-2 text-xs" onClick={() => update(p.patch)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="field-label">Background</span>
              <select name="backgroundType" className="input" value={values.backgroundType} onChange={set("backgroundType")}>
                <option value="solid">Solid color</option>
                <option value="linear">Linear gradient</option>
                <option value="radial">Radial gradient</option>
                <option value="image">Image</option>
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Background" name="bgColor" value={values.bgColor} onChange={(v) => update({ bgColor: v })} />
              {isGradient && <ColorField label="Second color" name="bgColor2" value={values.bgColor2 || values.accentColor} onChange={(v) => update({ bgColor2: v })} />}
            </div>
            {err("bgColor2")}
            {values.backgroundType === "linear" && (
              <label className="block">
                <span className="field-label">Gradient angle: {values.gradientAngle}°</span>
                <input name="gradientAngle" type="range" min={0} max={360} value={values.gradientAngle} onChange={(e) => update({ gradientAngle: Number(e.target.value) })} className="w-full" />
              </label>
            )}
            {isImage && (
              <>
                <label className="block">
                  <span className="field-label">Background image (PNG/JPG/WebP, up to 6 MB)</span>
                  <input name="background" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)} />
                  {backgroundPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={backgroundPreview} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
                  )}
                  {existingBackgroundUrl && !removeBackground && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" name="removeBackground" checked={removeBackground} onChange={(e) => setRemoveBackground(e.target.checked)} /> Remove current background
                    </label>
                  )}
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Overlay: {values.backgroundOverlay}%</span>
                    <input name="backgroundOverlay" type="range" min={0} max={80} value={values.backgroundOverlay} onChange={(e) => update({ backgroundOverlay: Number(e.target.value) })} className="w-full" />
                  </label>
                  <ColorField label="Overlay color" name="backgroundOverlayColor" value={values.backgroundOverlayColor} onChange={(v) => update({ backgroundOverlayColor: v })} />
                </div>
                <label className="block">
                  <span className="field-label">Focal point</span>
                  <select name="backgroundPosition" className="input" value={values.backgroundPosition} onChange={set("backgroundPosition")}>
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField label="Text" name="fgColor" value={values.fgColor} onChange={(v) => update({ fgColor: v })} />
              <ColorField label="Labels" name="labelColor" value={values.labelColor} onChange={(v) => update({ labelColor: v })} />
              <ColorField label="Accent" name="accentColor" value={values.accentColor} onChange={(v) => update({ accentColor: v })} />
            </div>
            {lowContrast && <p className="text-xs text-warning">Low contrast between text and background. Check readability.</p>}
            <label className="block">
              <span className="field-label">Font (public page & preview)</span>
              <select name="fontFamily" className="input" value={values.fontFamily} onChange={set("fontFamily")}>
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{FONT_LABELS[f]}</option>
                ))}
              </select>
              <p className="field-hint">Apple and Google Wallet use their own system font on the pass.</p>
            </label>
          </div>
        </details>

        <details className="panel" open>
          <summary className="cursor-pointer text-sm font-semibold">Logo & icon</summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Logo (wide, PNG/JPG/WebP)</span>
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                {existingLogoUrl && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} /> Remove current logo
                  </label>
                )}
              </label>
              <label className="block">
                <span className="field-label">Icon (square)</span>
                <input name="icon" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setIconFile(e.target.files?.[0] ?? null)} />
                {existingIconUrl && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="removeIcon" checked={removeIcon} onChange={(e) => setRemoveIcon(e.target.checked)} /> Remove uploaded icon
                  </label>
                )}
              </label>
            </div>
            <label className="block">
              <span className="field-label">Icon source</span>
              <select name="iconSource" className="input" value={values.iconSource} onChange={set("iconSource")}>
                <option value="auto">Uploaded if set, else preset/monogram</option>
                <option value="preset">Preset icon</option>
                <option value="monogram">Monogram</option>
              </select>
            </label>
            {values.iconSource !== "monogram" && (
              <div>
                <span className="field-label">Preset icon</span>
                <div className="grid grid-cols-5 gap-2">
                  {ICON_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`flex aspect-square items-center justify-center rounded-lg border ${values.iconPreset === p ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"}`}
                      onClick={() => update({ iconPreset: values.iconPreset === p ? "" : p })}
                      style={{ color: values.iconPreset === p ? values.accentColor : undefined }}
                    >
                      <Glyph path={ICON_PATHS[p]} size={20} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {values.iconSource !== "preset" && (
              <label className="block">
                <span className="field-label">Monogram (1–2 letters)</span>
                <input name="monogramText" className="input" maxLength={2} value={values.monogramText} onChange={set("monogramText")} placeholder={(values.name || "W").slice(0, 1).toUpperCase()} />
              </label>
            )}
            <label className="block">
              <span className="field-label">Icon shape</span>
              <select name="iconShape" className="input" value={values.iconShape} onChange={set("iconShape")}>
                {ICON_SHAPES.map((s) => (
                  <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-5 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">Text next to the logo</span>
                <input name="logoText" className="input" maxLength={20} value={values.logoText} onChange={set("logoText")} />
              </label>
              <label className="block">
                <span className="field-label">Top right label</span>
                <input name="headerLabel" className="input" maxLength={12} placeholder="ROME" value={values.headerLabel} onChange={set("headerLabel")} />
              </label>
              <label className="block">
                <span className="field-label">Top right value</span>
                <input name="headerValue" className="input" maxLength={20} placeholder="DevFest" value={values.headerValue} onChange={set("headerValue")} />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Label above the name</span>
              <input name="nameLabel" className="input" maxLength={24} placeholder={values.organizationName || "AI engineer"} value={values.nameLabel} onChange={set("nameLabel")} />
            </label>
          </div>
        </details>

        <details className="panel" open>
          <summary className="cursor-pointer text-sm font-semibold">Public page & buttons</summary>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="field-label">Favicon (PNG/JPG/WebP, up to 1 MB)</span>
              <input name="favicon" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)} />
              <div className="mt-2 flex items-center gap-2">
                {faviconPreview || (existingFaviconUrl && !removeFavicon) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faviconPreview ?? existingFaviconUrl ?? undefined} alt="" className="h-8 w-8 rounded" />
                ) : (
                  <span className="text-xs text-muted">No favicon — the card icon is used.</span>
                )}
                {existingFaviconUrl && (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="removeFavicon" checked={removeFavicon} onChange={(e) => setRemoveFavicon(e.target.checked)} /> Remove
                  </label>
                )}
              </div>
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Buttons (up to 6)</span>
                <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="add-link" onClick={addLink}>Add button</button>
              </div>
              <p className="field-hint">Shown on the public page and as links on the wallet pass.</p>
              <div className="mt-2 space-y-2">
                {values.links.map((link, i) => (
                  <div key={link.id} className="rounded-lg border border-border p-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input data-testid="link-label" value={link.label} placeholder="Label" maxLength={24} className="input" onChange={(e) => patchLink(link.id, { label: e.target.value })} />
                      <input data-testid="link-url" value={link.url} placeholder="https://" maxLength={500} className="input" onChange={(e) => patchLink(link.id, { url: e.target.value })} />
                      <div className="flex items-center gap-1">
                        <button type="button" className="btn-secondary px-2" disabled={i === 0} onClick={() => moveLink(link.id, -1)}>↑</button>
                        <button type="button" className="btn-secondary px-2" disabled={i === values.links.length - 1} onClick={() => moveLink(link.id, 1)}>↓</button>
                        <button type="button" className="btn-danger px-2" onClick={() => removeLink(link.id)}>×</button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <select className="input" value={link.icon} onChange={(e) => patchLink(link.id, { icon: e.target.value as CardLink["icon"] })}>
                        {LINK_ICONS.map((ic) => (
                          <option key={ic} value={ic}>{ic}</option>
                        ))}
                      </select>
                      <select className="input" value={link.style} onChange={(e) => patchLink(link.id, { style: e.target.value as CardLink["style"] })}>
                        {LINK_STYLES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              {err("links")}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Custom fields (up to 8)</span>
                <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="add-field" onClick={addField}>Add field</button>
              </div>
              <div className="mt-2 space-y-2">
                {values.customFields.map((f) => (
                  <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto_auto]">
                    <input data-testid="field-label" value={f.label} placeholder="Label" maxLength={16} className="input" onChange={(e) => patchField(f.id, { label: e.target.value })} />
                    <input data-testid="field-value" value={f.value} placeholder="Value" maxLength={60} className="input" onChange={(e) => patchField(f.id, { value: e.target.value })} />
                    <select className="input" value={f.location} onChange={(e) => patchField(f.id, { location: e.target.value as CardField["location"] })}>
                      <option value="front">Front</option>
                      <option value="back">Back</option>
                    </select>
                    <button type="button" className="btn-danger px-2" onClick={() => removeField(f.id)}>×</button>
                  </div>
                ))}
              </div>
              {err("customFields")}
            </div>
          </div>
        </details>

        <details className="panel" open>
          <summary className="cursor-pointer text-sm font-semibold">Barcode & options</summary>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="barcode" className="mt-1" checked={values.barcode} onChange={(e) => update({ barcode: e.target.checked })} />
              <span>
                <span className="font-medium">Show a code on the card</span>
                <span className="block text-muted">Anyone holding the card can show it to pass it on.</span>
              </span>
            </label>
            {values.barcode && (
              <>
                <label className="block">
                  <span className="field-label">Code type</span>
                  <select name="barcodeType" className="input" value={values.barcodeType} onChange={set("barcodeType")}>
                    {BARCODE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Content</span>
                  <select name="barcodeContent" className="input" value={values.barcodeContent} onChange={set("barcodeContent")}>
                    {BARCODE_CONTENTS.map((c) => (
                      <option key={c} value={c}>{c === "link" ? "Public link" : c === "website" ? "Website" : "Custom text"}</option>
                    ))}
                  </select>
                </label>
                {values.barcodeContent === "custom" && (
                  <label className="block">
                    <span className="field-label">Custom text</span>
                    <input name="barcodeValue" className="input" maxLength={240} value={values.barcodeValue} onChange={set("barcodeValue")} />
                    {err("barcodeValue")}
                  </label>
                )}
              </>
            )}
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="dayGlow" className="mt-1" checked={values.dayGlow} onChange={(e) => update({ dayGlow: e.target.checked })} />
              <span>
                <span className="font-medium">Glow that follows the hour</span>
                <span className="block text-muted">A colour strip that shifts with the hour. Replaces the hero strip when enabled.</span>
              </span>
            </label>
          </div>
        </details>

        <input type="hidden" name="links" value={JSON.stringify(values.links)} />
        <input type="hidden" name="customFields" value={JSON.stringify(values.customFields)} />
        {!isGradient && <input type="hidden" name="bgColor2" value={values.bgColor2} />}
        {!isImage && <input type="hidden" name="backgroundOverlay" value={values.backgroundOverlay} />}
        {!isImage && <input type="hidden" name="backgroundPosition" value={values.backgroundPosition} />}
        {!isImage && <input type="hidden" name="backgroundOverlayColor" value={values.backgroundOverlayColor} />}
        {values.barcodeContent !== "custom" && <input type="hidden" name="barcodeValue" value="" />}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.success && <p className="text-sm text-success">{state.success}</p>}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-sm font-medium text-muted">Preview</p>
        <PassPreview
          organizationName={values.organizationName}
          name={values.name}
          message={latestMessage || values.welcomeText}
          bgColor={values.bgColor}
          fgColor={values.fgColor}
          labelColor={values.labelColor}
          accentColor={values.accentColor}
          backgroundType={values.backgroundType}
          bgColor2={values.bgColor2 || null}
          gradientAngle={values.gradientAngle}
          backgroundOverlay={values.backgroundOverlay}
          backgroundOverlayColor={values.backgroundOverlayColor}
          backgroundPosition={values.backgroundPosition}
          backgroundImageUrl={backgroundPreview ?? (removeBackground ? null : existingBackgroundUrl)}
          fontFamily={values.fontFamily}
          logoUrl={logoPreview ?? (removeLogo ? null : existingLogoUrl)}
          iconUrl={iconPreview ?? (removeIcon ? null : existingIconUrl)}
          latestLabel={values.latestLabel}
          logoText={values.logoText}
          headerLabel={values.headerLabel}
          headerValue={values.headerValue}
          nameLabel={values.nameLabel}
          barcode={values.barcode}
          barcodeType={values.barcodeType}
          customFields={values.customFields}
          links={values.links}
          qrUrl={qrUrl}
          glowHue={values.dayGlow ? glowHue : null}
        />
      </div>
    </form>
  );
}
