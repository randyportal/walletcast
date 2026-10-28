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
  type LinkIcon,
} from "@/lib/cards/design";
import {
  DEFAULT_GOOGLE_CONFIG,
  GOOGLE_PASS_TYPES,
  GOOGLE_TYPE_LABELS,
  type GoogleCodeMode,
  type GoogleConfig,
  type GooglePassType,
} from "@/lib/cards/google";
import { DEFAULT_APPLE_CONFIG, type AppleConfig } from "@/lib/cards/apple";
import { DEFAULT_CONTENT_CONFIG, type ContentConfig } from "@/lib/cards/content";
import { ICON_PATHS, LINK_ICON_PATHS } from "@/lib/cards/icon-paths";
import { PassPreview } from "./PassPreview";
import { GooglePreview } from "./GooglePreview";
import { Glyph, UI_ICON_PATHS } from "./icons";

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
  googleConfig: GoogleConfig;
  appleConfig: AppleConfig;
  contentConfig: ContentConfig;
  publicPageMode: string;
  askEmail: boolean;
}

const DEFAULTS: CardFormValues = {
  name: "",
  organizationName: "",
  slug: "",
  description: "",
  welcomeText: "¡Gracias por agregar nuestra tarjeta! Aquí te mantendremos informado.",
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
  latestLabel: "ÚLTIMO",
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
  googleConfig: DEFAULT_GOOGLE_CONFIG,
  appleConfig: DEFAULT_APPLE_CONFIG,
  contentConfig: DEFAULT_CONTENT_CONFIG,
  publicPageMode: "full",
  askEmail: true,
};

const PRESETS: { name: string; patch: Partial<CardFormValues> }[] = [
  { name: "Medianoche", patch: { backgroundType: "linear", bgColor: "#0c0c0d", bgColor2: "#1f2937", fgColor: "#f4f2ee", labelColor: "#8d8a84", accentColor: "#6d28d9", fontFamily: "sans" } },
  { name: "Atardecer", patch: { backgroundType: "linear", bgColor: "#f97316", bgColor2: "#db2777", fgColor: "#ffffff", labelColor: "#fde68a", accentColor: "#7c3aed", fontFamily: "rounded" } },
  { name: "Océano", patch: { backgroundType: "linear", bgColor: "#0ea5e9", bgColor2: "#1e3a8a", fgColor: "#ffffff", labelColor: "#bae6fd", accentColor: "#0f766e", fontFamily: "sans" } },
  { name: "Bosque", patch: { backgroundType: "linear", bgColor: "#065f46", bgColor2: "#22c55e", fgColor: "#ffffff", labelColor: "#bbf7d0", accentColor: "#ca8a04", fontFamily: "serif" } },
  { name: "Caramelo", patch: { backgroundType: "linear", bgColor: "#f472b6", bgColor2: "#a855f7", fgColor: "#ffffff", labelColor: "#fce7f3", accentColor: "#db2777", fontFamily: "rounded" } },
  { name: "Oro", patch: { backgroundType: "linear", bgColor: "#1c1917", bgColor2: "#b45309", fgColor: "#fef3c7", labelColor: "#d6b46a", accentColor: "#d97706", fontFamily: "serif" } },
  { name: "Mono", patch: { backgroundType: "solid", bgColor: "#111827", fgColor: "#f9fafb", labelColor: "#9ca3af", accentColor: "#22d3ee", fontFamily: "mono" } },
  { name: "Aurora", patch: { backgroundType: "radial", bgColor: "#4c1d95", bgColor2: "#0f766e", fgColor: "#ffffff", labelColor: "#a5f3fc", accentColor: "#f43f5e", fontFamily: "sans" } },
];

const FONT_LABELS: Record<string, string> = {
  sans: "Sans",
  serif: "Serif",
  rounded: "Redondeada",
  mono: "Monoespaciada",
  condensed: "Condensada",
};

const CODE_MODE_LABELS: Record<string, string> = {
  auto: "Automático (según la tarjeta)",
  code: "Código / QR",
  text: "Texto en lugar del código",
  hidden: "Oculto",
};

const LINK_ICON_LABELS: Record<string, string> = {
  link: "Enlace",
  globe: "Globo",
  mail: "Correo",
  phone: "Teléfono",
  message: "Mensaje",
  pin: "Ubicación",
  instagram: "Instagram",
  calendar: "Calendario",
  bag: "Bolsa",
  star: "Estrella",
  contact: "Contacto",
  ticket: "Boleto",
  heart: "Corazón",
  coffee: "Café",
  crown: "Corona",
  sparkles: "Destellos",
  leaf: "Hoja",
  bolt: "Rayo",
};

const LINK_STYLE_LABELS: Record<string, string> = {
  primary: "Principal",
  secondary: "Secundario",
  outline: "Contorno",
};

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function IconPicker({ value, onChange }: { value: LinkIcon; onChange: (icon: LinkIcon) => void }) {
  return (
    <details className="relative">
      <summary className="btn-secondary list-none cursor-pointer px-2 py-1 text-xs [&::-webkit-details-marker]:hidden">
        <Glyph path={LINK_ICON_PATHS[value]} size={14} /> Icono
      </summary>
      <div className="mt-2 grid grid-cols-6 gap-1 rounded-lg border border-border bg-surface p-2">
        {LINK_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            title={LINK_ICON_LABELS[icon] ?? icon}
            aria-label={`Icono ${LINK_ICON_LABELS[icon] ?? icon}`}
            aria-pressed={value === icon}
            className={`flex h-9 w-9 items-center justify-center rounded ${value === icon ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
            onClick={() => onChange(icon)}
          >
            <Glyph path={LINK_ICON_PATHS[icon]} size={14} />
          </button>
        ))}
      </div>
    </details>
  );
}

const TABS = [
  { id: "content", label: "Contenido" },
  { id: "design", label: "Diseño" },
  { id: "code", label: "Código / QR" },
  { id: "recommendations", label: "Recomendaciones" },
  { id: "google", label: "Google Wallet" },
  { id: "apple", label: "Apple Wallet" },
  { id: "messages", label: "Mensajes" },
  { id: "public", label: "Página pública" },
  { id: "advanced", label: "Avanzado" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const TAB_ICONS: Record<Tab, keyof typeof UI_ICON_PATHS> = {
  content: "message",
  design: "palette",
  code: "code",
  recommendations: "star",
  google: "wallet",
  apple: "wallet",
  messages: "send",
  public: "public",
  advanced: "settings",
};

const TAB_HINTS: Record<Tab, string> = {
  content: "Nombre, textos y enlaces base",
  design: "Colores, fondo, logo e icono",
  code: "QR, código de barras y visibilidad",
  recommendations: "Accesos con icono para la tarjeta",
  google: "Botón, módulos y detalles del pase",
  apple: "Campos y enlaces del reverso",
  messages: "Último mensaje e historial",
  public: "Cómo se ve al agregar la tarjeta",
  advanced: "Brillo por hora del día",
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

function useFilePreviews(files: Record<string, File>): Record<string, string> {
  const previews = useMemo(
    () => Object.fromEntries(Object.entries(files).map(([id, file]) => [id, URL.createObjectURL(file)])),
    [files],
  );
  useEffect(() => () => {
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);
  return previews;
}

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: Partial<CardFormValues>;
  cardId?: string;
  existingLogoUrl?: string | null;
  existingIconUrl?: string | null;
  existingBackgroundUrl?: string | null;
  existingFaviconUrl?: string | null;
  existingAppleImageUrl?: string | null;
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
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface" />
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono text-xs" maxLength={7} />
      </div>
    </label>
  );
}

export function CardForm(props: Props) {
  const {
    action,
    initial,
    cardId,
    existingLogoUrl,
    existingIconUrl,
    existingBackgroundUrl,
    existingFaviconUrl,
    existingAppleImageUrl,
    latestMessage,
    qrUrl,
    glowHue,
    submitLabel,
  } = props;
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<CardFormValues>({
    ...DEFAULTS,
    ...initial,
    googleConfig: { ...DEFAULT_GOOGLE_CONFIG, ...(initial?.googleConfig ?? {}), valueModules: [] },
    appleConfig: { ...DEFAULT_APPLE_CONFIG, ...(initial?.appleConfig ?? {}) },
    contentConfig: { ...DEFAULT_CONTENT_CONFIG, ...(initial?.contentConfig ?? {}) },
  });
  const [tab, setTab] = useState<Tab>("content");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [preview, setPreview] = useState<"google" | "apple">("google");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [appleImageFile, setAppleImageFile] = useState<File | null>(null);
  const [imageModuleFile, setImageModuleFile] = useState<File | null>(null);
  const [linkIconFiles, setLinkIconFiles] = useState<Record<string, File>>({});
  const [removedLinkIcons, setRemovedLinkIcons] = useState<Record<string, boolean>>({});
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const [removeAppleImage, setRemoveAppleImage] = useState(false);

  const logoPreview = useObjectUrl(logoFile);
  const iconPreview = useObjectUrl(iconFile);
  const backgroundPreview = useObjectUrl(backgroundFile);
  const faviconPreview = useObjectUrl(faviconFile);
  const appleImagePreview = useObjectUrl(appleImageFile);
  const imageModulePreview = useObjectUrl(imageModuleFile);
  const linkIconPreviews = useFilePreviews(linkIconFiles);

  const update = (patch: Partial<CardFormValues>) => setValues((prev) => ({ ...prev, ...patch }));
  const google = values.googleConfig;
  const apple = values.appleConfig;
  const iconBackground = /^#[0-9a-fA-F]{6}$/.test(values.contentConfig.recommendations.iconBackground)
    ? values.contentConfig.recommendations.iconBackground
    : values.accentColor;
  const setGoogle = (patch: Partial<GoogleConfig>) => update({ googleConfig: { ...google, ...patch } });
  const setApple = (patch: Partial<AppleConfig>) => update({ appleConfig: { ...apple, ...patch } });

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

  const addLink = () => update({
    links: [...values.links, { id: uid(), label: "", subtitle: "", url: "https://", icon: "link", style: "secondary", iconAssetId: null, kind: "custom", visible: true }],
  });
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

  const setLinkUrl = (id: string, url: string) => {
    const link = values.links.find((item) => item.id === id);
    update({
      ...(link?.kind === "website" ? { websiteUrl: url } : link?.kind === "contact" ? { contactUrl: url } : {}),
      links: values.links.map((item) => (item.id === id ? { ...item, url, ...(item.kind === "website" ? { subtitle: hostOf(url) } : {}) } : item)),
    });
  };

  const upsertSpecialLink = (kind: "website" | "contact", enabled: boolean) => {
    if (!enabled) {
      update({ links: values.links.filter((link) => link.kind !== kind) });
      return;
    }
    if (values.links.some((link) => link.kind === kind)) return;
    const url = kind === "website" ? values.websiteUrl : values.contactUrl;
    const link = {
      id: kind,
      label: kind === "website" ? "Sitio web" : "Guardar contacto",
      subtitle: kind === "website" ? hostOf(url) : "Agrega nuestros datos a tu teléfono",
      url: url || "https://",
      icon: (kind === "website" ? "globe" : "contact") as LinkIcon,
      style: "secondary" as const,
      iconAssetId: null,
      kind,
      visible: true,
    };
    update({ links: [...values.links, link] });
  };

  const setLatest = (patch: Partial<ContentConfig["latest"]>) =>
    update({ contentConfig: { ...values.contentConfig, latest: { ...values.contentConfig.latest, ...patch } } });
  const setRecommendations = (patch: Partial<ContentConfig["recommendations"]>) =>
    update({ contentConfig: { ...values.contentConfig, recommendations: { ...values.contentConfig.recommendations, ...patch } } });
  const setWebsiteUrl = (value: string) =>
    update({
      websiteUrl: value,
      links: values.links.map((link) => (link.kind === "website" ? { ...link, url: value, subtitle: hostOf(value) } : link)),
    });
  const setContactUrl = (value: string) =>
    update({
      contactUrl: value,
      links: values.links.map((link) => (link.kind === "contact" ? { ...link, url: value } : link)),
    });

  const addTextModule = () => setGoogle({ textModules: [...google.textModules, { id: uid(), header: "", body: "" }] });
  const patchTextModule = (id: string, patch: Partial<{ header: string; body: string }>) =>
    setGoogle({ textModules: google.textModules.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeTextModule = (id: string) => setGoogle({ textModules: google.textModules.filter((m) => m.id !== id) });

  const addAppleTextModule = () => setApple({ textModules: [...apple.textModules, { id: uid(), header: "", body: "" }] });
  const patchAppleTextModule = (id: string, patch: Partial<{ header: string; body: string }>) =>
    setApple({ textModules: apple.textModules.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeAppleTextModule = (id: string) => setApple({ textModules: apple.textModules.filter((m) => m.id !== id) });

  const sectionClass = (id: Tab) => `panel ${tab === id ? "" : "hidden"}`;

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_400px]">
      <aside className="sticky top-6 hidden self-start rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-sm)] lg:block">
        <nav className="flex flex-col gap-1" aria-label="Secciones de la tarjeta">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "step" : undefined}
              className={`section-nav ${tab === item.id ? "section-nav-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <Glyph path={UI_ICON_PATHS[TAB_ICONS[item.id]]} size={17} />
              <span className="min-w-0">
                <span className="block">{item.label}</span>
                <span className="block truncate text-[11px] font-normal text-muted">{TAB_HINTS[item.id]}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 shadow-[var(--shadow-sm)] lg:hidden" aria-label="Secciones de la tarjeta">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "step" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${tab === item.id ? "bg-accent text-accent-foreground" : "text-muted"}`}
              onClick={() => setTab(item.id)}
            >
              <Glyph path={UI_ICON_PATHS[TAB_ICONS[item.id]]} size={14} />
              {item.label}
            </button>
          ))}
        </div>

        <section className={sectionClass("content")}>
          <h2 className="text-lg font-semibold">Contenido</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Nombre del negocio</span>
                <input name="organizationName" className="input" required maxLength={60} value={values.organizationName} onChange={set("organizationName")} />
                {err("organizationName")}
              </label>
              <label className="block">
                <span className="field-label">Nombre de la tarjeta</span>
                <input name="name" className="input" required maxLength={60} value={values.name} onChange={set("name")} placeholder="Club VIP" />
                {err("name")}
              </label>
            </div>
            <label className="block">
              <span className="field-label">Enlace público</span>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted">/c/</span>
                <input name="slug" className="input" required maxLength={48} value={values.slug} onChange={(e) => { setSlugTouched(true); set("slug")(e); }} />
              </div>
              {err("slug")}
            </label>
            <label className="block">
              <span className="field-label">Mensaje que se muestra al agregar la tarjeta</span>
              <input name="welcomeText" className="input" maxLength={200} value={values.welcomeText} onChange={set("welcomeText")} />
              <p className="field-hint">Se sustituye por tu último envío.</p>
            </label>
            <label className="block">
              <span className="field-label">Descripción (reverso de la tarjeta)</span>
              <textarea name="description" className="input min-h-20" maxLength={500} value={values.description} onChange={set("description")} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Sitio web</span>
                <input name="websiteUrl" type="url" className="input" placeholder="https://" value={values.websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                {err("websiteUrl")}
              </label>
              <label className="block">
                <span className="field-label">Archivo de contacto (vCard)</span>
                <input name="contactUrl" type="url" className="input" placeholder="https://" value={values.contactUrl} onChange={(e) => setContactUrl(e.target.value)} />
                {err("contactUrl")}
              </label>
            </div>
          </div>
        </section>

        <section className={sectionClass("design")}>
          <h2 className="text-lg font-semibold">Diseño</h2>
          <div className="mt-4 space-y-4">
            <div>
              <span className="field-label">Preajustes</span>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="btn-secondary px-2 text-xs" onClick={() => update(p.patch)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="field-label">Fondo</span>
              <select name="backgroundType" className="input" value={values.backgroundType} onChange={set("backgroundType")}>
                <option value="solid">Color sólido</option>
                <option value="linear">Degradado lineal</option>
                <option value="radial">Degradado radial</option>
                <option value="image">Imagen</option>
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Color de fondo" name="bgColor" value={values.bgColor} onChange={(v) => update({ bgColor: v })} />
              {isGradient && <ColorField label="Segundo color" name="bgColor2" value={values.bgColor2 || values.accentColor} onChange={(v) => update({ bgColor2: v })} />}
            </div>
            {err("bgColor2")}
            {values.backgroundType === "linear" && (
              <label className="block">
                <span className="field-label">Ángulo del degradado: {values.gradientAngle}°</span>
                <input name="gradientAngle" type="range" min={0} max={360} value={values.gradientAngle} onChange={(e) => update({ gradientAngle: Number(e.target.value) })} className="w-full" />
              </label>
            )}
            {isImage && (
              <>
                <label className="block">
                  <span className="field-label">Imagen de fondo (PNG/JPG/WebP, hasta 6 MB)</span>
                  <input name="background" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setBackgroundFile(e.target.files?.[0] ?? null); setRemoveBackground(false); }} />
                  {backgroundPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={backgroundPreview} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
                  )}
                  {existingBackgroundUrl && !removeBackground && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" name="removeBackground" checked={removeBackground} onChange={(e) => setRemoveBackground(e.target.checked)} /> Quitar imagen actual
                    </label>
                  )}
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Superposición: {values.backgroundOverlay}%</span>
                    <input name="backgroundOverlay" type="range" min={0} max={80} value={values.backgroundOverlay} onChange={(e) => update({ backgroundOverlay: Number(e.target.value) })} className="w-full" />
                  </label>
                  <ColorField label="Color de superposición" name="backgroundOverlayColor" value={values.backgroundOverlayColor} onChange={(v) => update({ backgroundOverlayColor: v })} />
                </div>
                <label className="block">
                  <span className="field-label">Punto focal</span>
                  <select name="backgroundPosition" className="input" value={values.backgroundPosition} onChange={set("backgroundPosition")}>
                    <option value="center">Centro</option>
                    <option value="top">Arriba</option>
                    <option value="bottom">Abajo</option>
                    <option value="left">Izquierda</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField label="Texto" name="fgColor" value={values.fgColor} onChange={(v) => update({ fgColor: v })} />
              <ColorField label="Etiquetas" name="labelColor" value={values.labelColor} onChange={(v) => update({ labelColor: v })} />
              <ColorField label="Acento" name="accentColor" value={values.accentColor} onChange={(v) => update({ accentColor: v })} />
            </div>
            {lowContrast && <p className="text-xs text-warning">Hay poco contraste entre el texto y el fondo. Revisa la legibilidad.</p>}
            <label className="block">
              <span className="field-label">Fuente (página pública y vista previa)</span>
              <select name="fontFamily" className="input" value={values.fontFamily} onChange={set("fontFamily")}>
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{FONT_LABELS[f]}</option>
                ))}
              </select>
              <p className="field-hint">Apple y Google Wallet usan su propia fuente en el pase.</p>
            </label>
          </div>
        </section>

        <section className={sectionClass("design")}>
          <h2 className="text-lg font-semibold">Logo e icono</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Logo (ancho, PNG/JPG/WebP)</span>
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setLogoFile(e.target.files?.[0] ?? null); setRemoveLogo(false); }} />
                {existingLogoUrl && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} /> Quitar logo actual
                  </label>
                )}
              </label>
              <label className="block">
                <span className="field-label">Icono (cuadrado)</span>
                <input name="icon" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setIconFile(e.target.files?.[0] ?? null); setRemoveIcon(false); }} />
                {existingIconUrl && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="removeIcon" checked={removeIcon} onChange={(e) => setRemoveIcon(e.target.checked)} /> Quitar icono subido
                  </label>
                )}
              </label>
            </div>
            <label className="block">
              <span className="field-label">Origen del icono</span>
              <select name="iconSource" className="input" value={values.iconSource} onChange={set("iconSource")}>
                <option value="auto">El subido si existe; si no, preajuste o monograma</option>
                <option value="preset">Icono preajustado</option>
                <option value="monogram">Monograma</option>
              </select>
            </label>
            {values.iconSource !== "monogram" && (
              <div>
                <span className="field-label">Icono preajustado</span>
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
                <span className="field-label">Monograma (1–2 letras)</span>
                <input name="monogramText" className="input" maxLength={2} value={values.monogramText} onChange={set("monogramText")} placeholder={(values.name || "W").slice(0, 1).toUpperCase()} />
              </label>
            )}
            <label className="block">
              <span className="field-label">Forma del icono</span>
              <select name="iconShape" className="input" value={values.iconShape} onChange={set("iconShape")}>
                {ICON_SHAPES.map((s) => (
                  <option key={s} value={s}>{s === "rounded" ? "Redondeado" : s === "circle" ? "Círculo" : "Cuadrado"}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-5 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">Texto junto al logo</span>
                <input name="logoText" className="input" maxLength={20} value={values.logoText} onChange={set("logoText")} />
              </label>
              <label className="block">
                <span className="field-label">Etiqueta superior derecha</span>
                <input name="headerLabel" className="input" maxLength={12} placeholder="ROMA" value={values.headerLabel} onChange={set("headerLabel")} />
              </label>
              <label className="block">
                <span className="field-label">Valor superior derecho</span>
                <input name="headerValue" className="input" maxLength={20} placeholder="DevFest" value={values.headerValue} onChange={set("headerValue")} />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Etiqueta sobre el nombre</span>
              <input name="nameLabel" className="input" maxLength={24} placeholder={values.organizationName || "Ingeniero AI"} value={values.nameLabel} onChange={set("nameLabel")} />
            </label>
          </div>
        </section>

        <section className={sectionClass("code")}>
          <h2 className="text-lg font-semibold">Código / QR</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="barcode" className="mt-1" checked={values.barcode} onChange={(e) => update({ barcode: e.target.checked })} />
              <span>
                <span className="font-medium">Mostrar un código en la tarjeta</span>
                <span className="block text-muted">Se usa en Apple Wallet, Google Wallet y la página pública. En Google puedes sustituirlo por texto u ocultarlo.</span>
              </span>
            </label>
            {values.barcode && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Tipo de código</span>
                    <select name="barcodeType" className="input" value={values.barcodeType} onChange={set("barcodeType")}>
                      {BARCODE_TYPES.map((type) => (
                        <option key={type} value={type}>{type.toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Contenido del código</span>
                    <select name="barcodeContent" className="input" value={values.barcodeContent} onChange={set("barcodeContent")}>
                      {BARCODE_CONTENTS.map((content) => (
                        <option key={content} value={content}>{content === "link" ? "Enlace público" : content === "website" ? "Sitio web" : "Texto personalizado"}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {values.barcodeContent === "custom" && (
                  <label className="block">
                    <span className="field-label">Texto del código</span>
                    <input name="barcodeValue" className="input" maxLength={240} value={values.barcodeValue} onChange={set("barcodeValue")} />
                    {err("barcodeValue")}
                  </label>
                )}
              </>
            )}
          </div>
        </section>

        <section className={sectionClass("recommendations")}>
          <h2 className="text-lg font-semibold">Recomendaciones</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Recomendaciones</span>
                <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="add-link" disabled={values.links.length >= 12} onClick={addLink}>Agregar recomendación</button>
              </div>
              <p className="field-hint">Se muestran en Google Wallet, en el reverso de Apple y en la página pública. Google admite hasta 15; aquí se limitan a 12 para mantener la tarjeta limpia.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values.links.some((link) => link.kind === "website")}
                    disabled={!values.websiteUrl}
                    onChange={(e) => upsertSpecialLink("website", e.target.checked)}
                  />
                  Incluir sitio web
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values.links.some((link) => link.kind === "contact")}
                    disabled={!values.contactUrl}
                    onChange={(e) => upsertSpecialLink("contact", e.target.checked)}
                  />
                  Incluir guardar contacto
                </label>
              </div>
              {!values.websiteUrl && <p className="field-hint">Agrega el sitio web en Contenido para poder incluirlo.</p>}
              {!values.contactUrl && <p className="field-hint">Agrega el archivo de contacto en Contenido para poder incluirlo.</p>}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={values.contentConfig.recommendations.show} onChange={(e) => setRecommendations({ show: e.target.checked })} />
                  Mostrar recomendaciones
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Título
                  <input className="input max-w-48" maxLength={35} value={values.contentConfig.recommendations.title} onChange={(e) => setRecommendations({ title: e.target.value })} />
                </label>
                <label className="block">
                  <span className="field-label">Fondo de iconos</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={iconBackground} onChange={(e) => setRecommendations({ iconBackground: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface" />
                    <input className="input w-28 font-mono text-xs" maxLength={7} value={values.contentConfig.recommendations.iconBackground || values.accentColor} onChange={(e) => setRecommendations({ iconBackground: e.target.value })} />
                    <button type="button" className="text-xs underline" onClick={() => setRecommendations({ iconBackground: "" })}>Usar acento</button>
                  </div>
                  <p className="field-hint">Se aplica a iconos preset y subidos. Evita el fondo blanco de Google Wallet.</p>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 p-2">
                <span className="text-xs text-muted">Muestra:</span>
                {values.links.filter((link) => link.visible).slice(0, 5).map((link) => (
                  <span key={link.id} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md" style={{ background: iconBackground }}>
                    {linkIconPreviews[link.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={linkIconPreviews[link.id]} alt="" className="h-full w-full object-contain p-1" />
                    ) : link.iconAssetId && cardId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/cards/${cardId}/asset/${link.iconAssetId}`} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span style={{ color: contrastRatio(iconBackground, "#000000") >= contrastRatio(iconBackground, "#ffffff") ? "#000" : "#fff" }}>
                        <Glyph path={LINK_ICON_PATHS[link.icon]} size={15} />
                      </span>
                    )}
                  </span>
                ))}
                {values.links.filter((link) => link.visible).length === 0 && <span className="text-xs text-muted">Agrega una recomendación visible.</span>}
              </div>
              <div className="mt-3 space-y-3">
                {values.links.map((link, i) => (
                  <div key={link.id} className="space-y-2 rounded-lg border border-border p-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input data-testid="link-label" value={link.label} placeholder="Título" maxLength={60} className="input" onChange={(e) => patchLink(link.id, { label: e.target.value })} />
                      <input
                        data-testid="link-url"
                        value={link.url}
                        placeholder="https://"
                        maxLength={500}
                        className="input"
                        onChange={(e) => setLinkUrl(link.id, e.target.value)}
                      />
                      <div className="flex items-center gap-1">
                        <button type="button" className="btn-secondary px-2" aria-label="Mover recomendación arriba" disabled={i === 0} onClick={() => moveLink(link.id, -1)}><Glyph path={UI_ICON_PATHS.arrowUp} size={14} /></button>
                        <button type="button" className="btn-secondary px-2" aria-label="Mover recomendación abajo" disabled={i === values.links.length - 1} onClick={() => moveLink(link.id, 1)}><Glyph path={UI_ICON_PATHS.arrowDown} size={14} /></button>
                        <button type="button" className="btn-danger px-2" aria-label="Eliminar recomendación" onClick={() => removeLink(link.id)}><Glyph path={UI_ICON_PATHS.trash} size={14} /></button>
                      </div>
                    </div>
                    <input value={link.subtitle} placeholder="Subtítulo corto (opcional)" maxLength={50} className="input" onChange={(e) => patchLink(link.id, { subtitle: e.target.value })} />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={link.visible} onChange={(e) => patchLink(link.id, { visible: e.target.checked })} />
                        Visible
                      </label>
                      {link.kind !== "custom" && <span className="badge">{link.kind === "website" ? "Sitio web" : "Contacto"}</span>}
                      <IconPicker value={link.icon} onChange={(icon) => patchLink(link.id, { icon })} />
                      <select className="input max-w-40" value={link.style} onChange={(e) => patchLink(link.id, { style: e.target.value as CardLink["style"] })}>
                        {LINK_STYLES.map((s) => (
                          <option key={s} value={s}>{LINK_STYLE_LABELS[s] ?? s}</option>
                        ))}
                      </select>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ background: iconBackground }}>
                        {linkIconPreviews[link.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={linkIconPreviews[link.id]} alt="" className="h-full w-full object-contain p-1" />
                        ) : link.iconAssetId && cardId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/cards/${cardId}/asset/${link.iconAssetId}`} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span style={{ color: contrastRatio(iconBackground, "#000000") >= contrastRatio(iconBackground, "#ffffff") ? "#000" : "#fff" }}>
                            <Glyph path={LINK_ICON_PATHS[link.icon]} size={16} />
                          </span>
                        )}
                      </span>
                      <input
                        type="file"
                        name={`linkIcon:${link.id}`}
                        accept="image/png,image/jpeg,image/webp"
                        className="text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLinkIconFiles((prev) => ({ ...prev, [link.id]: file }));
                          setRemovedLinkIcons((prev) => ({ ...prev, [link.id]: false }));
                        }}
                      />
                      {(link.iconAssetId || linkIconFiles[link.id]) && (
                        <button
                          type="button"
                          className="text-xs text-danger"
                          onClick={() => {
                            setRemovedLinkIcons((prev) => ({ ...prev, [link.id]: true }));
                            patchLink(link.id, { iconAssetId: null });
                          }}
                        >
                          Usar preajuste
                        </button>
                      )}
                    </div>
                    {removedLinkIcons[link.id] && <input type="hidden" name={`removeLinkIcon:${link.id}`} value="on" />}
                  </div>
                ))}
              </div>
              {err("links")}
            </div>

          </div>
        </section>

        <section className={sectionClass("google")}>
          <h2 className="text-lg font-semibold">Google Wallet</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="field-label">Tipo de pase</span>
              <select className="input" value={google.type} onChange={(e) => setGoogle({ type: e.target.value as GooglePassType })}>
                {GOOGLE_PASS_TYPES.map((type) => (
                  <option key={type} value={type}>{GOOGLE_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Texto del botón frontal (opcional)</span>
                <input
                  className="input"
                  maxLength={30}
                  value={google.button?.label ?? ""}
                  onChange={(e) => {
                    const label = e.target.value;
                    setGoogle({ button: label || google.button?.url ? { label, url: google.button?.url ?? "" } : null });
                  }}
                />
              </label>
              <label className="block">
                <span className="field-label">URL del botón frontal</span>
                <input
                  className="input"
                  placeholder="https://"
                  value={google.button?.url ?? ""}
                  onChange={(e) => {
                    const url = e.target.value;
                    setGoogle({ button: url || google.button?.label ? { label: google.button?.label ?? "", url } : null });
                  }}
                />
              </label>
            </div>
            <p className="field-hint">Muestra un botón en la parte frontal del pase de Google.</p>

            <label className="block">
              <span className="field-label">Zona del código</span>
              <select className="input" value={google.code.mode} onChange={(e) => setGoogle({ code: { ...google.code, mode: e.target.value as GoogleCodeMode } })}>
                {(["auto", "code", "text", "hidden"] as const).map((mode) => (
                  <option key={mode} value={mode}>{CODE_MODE_LABELS[mode]}</option>
                ))}
              </select>
            </label>
            {google.code.mode === "text" && (
              <label className="block">
                <span className="field-label">Texto que sustituye al código</span>
                <input className="input" maxLength={60} value={google.code.text} onChange={(e) => setGoogle({ code: { ...google.code, text: e.target.value } })} placeholder="SOCIO 123" />
              </label>
            )}

            <div className="space-y-2">
              {[
                ["showDescription", "Mostrar descripción"],
                ["showCustomFields", "Mostrar campos personalizados"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(google[key as "showDescription" | "showCustomFields"])}
                    onChange={(e) => setGoogle({ [key]: e.target.checked } as Partial<GoogleConfig>)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Módulos de texto extra</span>
                <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="add-text-module" onClick={addTextModule}>Agregar texto</button>
              </div>
              <div className="mt-2 space-y-2">
                {google.textModules.map((textModule) => (
                  <div key={textModule.id} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                    <input className="input" placeholder="Encabezado" maxLength={35} value={textModule.header} onChange={(e) => patchTextModule(textModule.id, { header: e.target.value })} />
                    <input className="input" placeholder="Texto" maxLength={500} value={textModule.body} onChange={(e) => patchTextModule(textModule.id, { body: e.target.value })} />
                    <button type="button" className="btn-danger px-2" aria-label="Eliminar módulo de texto" onClick={() => removeTextModule(textModule.id)}><Glyph path={UI_ICON_PATHS.trash} size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Módulo de imagen (opcional)</span>
                {google.imageModule ? (
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => { setGoogle({ imageModule: null }); setImageModuleFile(null); }}>Quitar imagen</button>
                ) : (
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="add-image-module" onClick={() => setGoogle({ imageModule: { assetId: null, description: "" } })}>Agregar imagen</button>
                )}
              </div>
              {google.imageModule && (
                <div className="mt-2 space-y-2">
                  <input className="input" placeholder="Descripción de la imagen" maxLength={100} value={google.imageModule.description} onChange={(e) => setGoogle({ imageModule: { ...google.imageModule!, description: e.target.value } })} />
                  <input type="file" name="imageModuleFile" accept="image/png,image/jpeg,image/webp" className="text-xs" onChange={(e) => setImageModuleFile(e.target.files?.[0] ?? null)} />
                  {(imageModulePreview || (google.imageModule.assetId && cardId)) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageModulePreview ?? `/api/cards/${cardId}/asset/${google.imageModule.assetId}`}
                      alt=""
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={sectionClass("apple")}>
          <h2 className="text-lg font-semibold">Apple Wallet</h2>
          <p className="mt-1 text-sm text-muted">
            Apple no permite botones flotantes ni imágenes dentro del cuerpo del pase. Estas opciones se traducen a enlaces al reverso, campos y una imagen de banner.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="field-label">Texto alternativo bajo el código (opcional)</span>
              <input className="input" maxLength={60} value={apple.codeText} onChange={(e) => setApple({ codeText: e.target.value })} placeholder="SOCIO 123" />
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={apple.showDescription} onChange={(e) => setApple({ showDescription: e.target.checked })} />
                Mostrar descripción en el reverso
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={apple.showCustomFields} onChange={(e) => setApple({ showCustomFields: e.target.checked })} />
                Mostrar campos personalizados
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Botón / enlace principal (opcional)</span>
                <input
                  className="input"
                  maxLength={30}
                  value={apple.button?.label ?? ""}
                  onChange={(e) => {
                    const label = e.target.value;
                    setApple({ button: label || apple.button?.url ? { label, url: apple.button?.url ?? "" } : null });
                  }}
                />
              </label>
              <label className="block">
                <span className="field-label">URL del botón / enlace</span>
                <input
                  className="input"
                  placeholder="https://"
                  value={apple.button?.url ?? ""}
                  onChange={(e) => {
                    const url = e.target.value;
                    setApple({ button: url || apple.button?.label ? { label: apple.button?.label ?? "", url } : null });
                  }}
                />
              </label>
            </div>
            <p className="field-hint">Se muestra como un enlace tocable al reverso de la tarjeta.</p>

            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Módulos de texto extra</span>
                <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={addAppleTextModule}>Agregar texto</button>
              </div>
              <div className="mt-2 space-y-2">
                {apple.textModules.map((textModule) => (
                  <div key={textModule.id} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                    <input className="input" placeholder="Encabezado" maxLength={35} value={textModule.header} onChange={(e) => patchAppleTextModule(textModule.id, { header: e.target.value })} />
                    <input className="input" placeholder="Texto" maxLength={500} value={textModule.body} onChange={(e) => patchAppleTextModule(textModule.id, { body: e.target.value })} />
                    <button type="button" className="btn-danger px-2" aria-label="Eliminar módulo de Apple" onClick={() => removeAppleTextModule(textModule.id)}><Glyph path={UI_ICON_PATHS.trash} size={14} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="field-label">Imagen de banner (opcional)</span>
              <input name="appleImage" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setAppleImageFile(e.target.files?.[0] ?? null); setRemoveAppleImage(false); }} />
              <input className="input mt-2" placeholder="Descripción de la imagen" maxLength={100} value={apple.imageDescription} onChange={(e) => setApple({ imageDescription: e.target.value })} />
              {(appleImagePreview || (existingAppleImageUrl && !removeAppleImage)) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={appleImagePreview ?? existingAppleImageUrl ?? undefined} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
              )}
              {existingAppleImageUrl && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" name="removeAppleImage" checked={removeAppleImage} onChange={(e) => setRemoveAppleImage(e.target.checked)} /> Quitar imagen actual
                </label>
              )}
            </div>
          </div>
        </section>

        <section className={sectionClass("messages")}>
          <h2 className="text-lg font-semibold">Mensajes</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={values.contentConfig.latest.show} onChange={(e) => setLatest({ show: e.target.checked })} />
              <span>
                <span className="font-medium">Mostrar el último mensaje en la tarjeta principal</span>
                <span className="block text-muted">Apple seguirá notificando aunque lo ocultes del frente. Google notifica con el mensaje, no con el módulo visible.</span>
              </span>
            </label>
            <label className="block">
              <span className="field-label">Etiqueta del último mensaje</span>
              <input name="latestLabel" className="input" maxLength={12} value={values.latestLabel} onChange={set("latestLabel")} />
              {err("latestLabel")}
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={values.contentConfig.latest.showHistory} onChange={(e) => setLatest({ showHistory: e.target.checked })} />
              <span>
                <span className="font-medium">Permitir ver el historial desde la tarjeta</span>
                <span className="block text-muted">Google lo muestra como módulo en el detalle; Apple en el reverso; la página pública en una sección desplegable.</span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Título del historial</span>
                <input className="input" maxLength={35} value={values.contentConfig.latest.historyTitle} onChange={(e) => setLatest({ historyTitle: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Mensajes en el historial</span>
                <input type="number" min={1} max={10} className="input" value={values.contentConfig.latest.historyLimit} onChange={(e) => setLatest({ historyLimit: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
              </label>
            </div>
            <p className="field-hint">En la tarjeta principal solo se ve el último mensaje. El historial queda en una sección aparte.</p>
          </div>
        </section>

        <section className={sectionClass("public")}>
          <h2 className="text-lg font-semibold">Página pública</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="field-label">Estilo de la página pública</span>
              <select name="publicPageMode" className="input" value={values.publicPageMode} onChange={set("publicPageMode")}>
                <option value="full">Completa (vista previa, descripción, recomendaciones y campos)</option>
                <option value="minimal">Mínima (vista previa + botón de agregar)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="askEmail" value="off" />
              <input type="checkbox" name="askEmail" checked={values.askEmail} onChange={(e) => update({ askEmail: e.target.checked })} />
              Pedir correo en la página pública completa
            </label>

            <label className="block">
              <span className="field-label">Favicon (PNG/JPG/WebP, hasta 1 MB)</span>
              <input name="favicon" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setFaviconFile(e.target.files?.[0] ?? null); setRemoveFavicon(false); }} />
              <div className="mt-2 flex items-center gap-2">
                {faviconPreview || (existingFaviconUrl && !removeFavicon) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faviconPreview ?? existingFaviconUrl ?? undefined} alt="" className="h-8 w-8 rounded" />
                ) : (
                  <span className="text-xs text-muted">Sin favicon: se usa el icono de la tarjeta.</span>
                )}
                {existingFaviconUrl && (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="removeFavicon" checked={removeFavicon} onChange={(e) => setRemoveFavicon(e.target.checked)} /> Quitar
                  </label>
                )}
              </div>
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="field-label">Campos personalizados (hasta 8)</span>
                <button type="button" className="btn-secondary px-2 py-1 text-xs" data-testid="add-field" onClick={addField}>Agregar campo</button>
              </div>
              <div className="mt-2 space-y-2">
                {values.customFields.map((f) => (
                  <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto_auto]">
                    <input data-testid="field-label" value={f.label} placeholder="Etiqueta" maxLength={16} className="input" onChange={(e) => patchField(f.id, { label: e.target.value })} />
                    <input data-testid="field-value" value={f.value} placeholder="Valor" maxLength={60} className="input" onChange={(e) => patchField(f.id, { value: e.target.value })} />
                    <select className="input" value={f.location} onChange={(e) => patchField(f.id, { location: e.target.value as CardField["location"] })}>
                      <option value="front">Frente</option>
                      <option value="back">Reverso</option>
                    </select>
                    <button type="button" className="btn-danger px-2" aria-label="Eliminar campo" onClick={() => removeField(f.id)}><Glyph path={UI_ICON_PATHS.trash} size={14} /></button>
                  </div>
                ))}
              </div>
              {err("customFields")}
            </div>
          </div>
        </section>

        <section className={sectionClass("advanced")}>
          <h2 className="text-lg font-semibold">Avanzado</h2>
          <div className="mt-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="dayGlow" className="mt-1" checked={values.dayGlow} onChange={(e) => update({ dayGlow: e.target.checked })} />
              <span>
                <span className="font-medium">Brillo que sigue la hora del día</span>
                <span className="block text-muted">Una franja de color que cambia con la hora. Sustituye la franja principal cuando está activa.</span>
              </span>
            </label>
          </div>
        </section>

        <input type="hidden" name="links" value={JSON.stringify(values.links)} />
        <input type="hidden" name="customFields" value={JSON.stringify(values.customFields)} />
        <input type="hidden" name="googleConfig" value={JSON.stringify(values.googleConfig)} />
        <input type="hidden" name="appleConfig" value={JSON.stringify(values.appleConfig)} />
        <input type="hidden" name="contentConfig" value={JSON.stringify(values.contentConfig)} />
        {!isGradient && <input type="hidden" name="bgColor2" value={values.bgColor2} />}
        {!isImage && <input type="hidden" name="backgroundOverlay" value={values.backgroundOverlay} />}
        {!isImage && <input type="hidden" name="backgroundPosition" value={values.backgroundPosition} />}
        {!isImage && <input type="hidden" name="backgroundOverlayColor" value={values.backgroundOverlayColor} />}
        {values.barcodeContent !== "custom" && <input type="hidden" name="barcodeValue" value="" />}

        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-[var(--shadow-md)] backdrop-blur-xl">
          <div className="min-w-0 space-y-1">
            {state.error ? (
              <p role="alert" className="text-sm text-danger">{state.error}</p>
            ) : state.success ? (
              <p role="status" className="text-sm text-success">{state.success}</p>
            ) : (
              <p className="text-xs text-muted">Los cambios se aplican al guardar.</p>
            )}
            {state.warnings?.map((warning) => (
              <p key={warning} className="text-xs text-warning">{warning}</p>
            ))}
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-6 xl:self-start">
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-sm)]">
          <p className="px-1 text-sm font-semibold">Vista previa</p>
          <button type="button" aria-pressed={preview === "google"} className={`badge ${preview === "google" ? "border-accent/30 bg-accent/10 text-accent" : ""}`} onClick={() => setPreview("google")}>Google</button>
          <button type="button" aria-pressed={preview === "apple"} className={`badge ${preview === "apple" ? "border-accent/30 bg-accent/10 text-accent" : ""}`} onClick={() => setPreview("apple")}>Apple</button>
        </div>
        {preview === "google" ? (
          <GooglePreview
            organizationName={values.organizationName}
            name={values.name}
            latestLabel={values.latestLabel}
            description={values.description}
            message={latestMessage || values.welcomeText}
            websiteUrl={values.websiteUrl}
            contactUrl={values.contactUrl}
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
            barcode={values.barcode}
            qrUrl={qrUrl}
            glowHue={values.dayGlow ? glowHue : null}
            googleConfig={values.googleConfig}
            contentConfig={values.contentConfig}
            links={values.contentConfig.recommendations.show ? values.links.filter((link) => link.visible) : []}
            customFields={values.customFields}
            cardId={cardId}
          />
        ) : (
          <PassPreview
            organizationName={values.organizationName}
            name={values.name}
            description={values.description}
            message={latestMessage || values.welcomeText}
            websiteUrl={values.websiteUrl}
            contactUrl={values.contactUrl}
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
            qrUrl={qrUrl}
            glowHue={values.dayGlow ? glowHue : null}
            appleConfig={values.appleConfig}
            contentConfig={values.contentConfig}
            links={values.contentConfig.recommendations.show ? values.links.filter((link) => link.visible) : []}
            cardId={cardId}
            appleImageUrl={appleImagePreview ?? (removeAppleImage ? null : existingAppleImageUrl)}
          />
        )}
      </div>
    </form>
  );
}
