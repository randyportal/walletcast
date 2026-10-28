import {
  cardBackgroundStyle,
  cardUsesHero,
  contrastRatio,
  type CardField,
  type CardLink,
  type LinkIcon,
} from "@/lib/cards/design";
import { fontStack } from "@/lib/cards/fonts";
import { normalizeGoogleConfig, type GoogleConfig } from "@/lib/cards/google";
import { LINK_ICON_PATHS } from "@/lib/cards/icon-paths";
import { Glyph } from "./icons";

export interface GooglePreviewProps {
  organizationName: string;
  name: string;
  description?: string;
  message: string;
  websiteUrl?: string;
  contactUrl?: string;
  bgColor: string;
  fgColor: string;
  labelColor: string;
  accentColor: string;
  backgroundType: string;
  bgColor2: string | null;
  gradientAngle: number;
  backgroundOverlay: number;
  backgroundOverlayColor: string;
  backgroundPosition: string;
  backgroundImageUrl?: string | null;
  fontFamily?: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  barcode?: boolean;
  qrUrl?: string | null;
  glowHue?: number | null;
  googleConfig: GoogleConfig;
  links: CardLink[];
  customFields: CardField[];
  cardId?: string;
}

function accentText(hex: string): string {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#ffffff") ? "#000000" : "#ffffff";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ModuleIcon({
  icon,
  assetId,
  cardId,
  accent,
}: {
  icon: LinkIcon;
  assetId?: string | null;
  cardId?: string;
  accent: string;
}) {
  if (assetId && cardId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/cards/${cardId}/asset/${assetId}`} alt="" className="h-8 w-8 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: accent, color: accentText(accent) }}>
      <Glyph path={LINK_ICON_PATHS[icon]} size={16} />
    </span>
  );
}

export function GooglePreview(props: GooglePreviewProps) {
  const config = normalizeGoogleConfig(props.googleConfig);
  const hero = cardUsesHero({ dayGlow: props.glowHue != null, backgroundType: props.backgroundType });
  const style = cardBackgroundStyle({
    backgroundType: props.backgroundType,
    bgColor: props.bgColor,
    bgColor2: props.bgColor2,
    gradientAngle: props.gradientAngle,
    backgroundOverlay: props.backgroundOverlay,
    backgroundOverlayColor: props.backgroundOverlayColor,
    backgroundPosition: props.backgroundPosition,
    backgroundImageUrl: props.backgroundImageUrl,
  });
  const mode = config.code.mode === "auto" ? (props.barcode ? "code" : "hidden") : config.code.mode;
  const frontFields = (props.customFields ?? []).filter((f) => f.location === "front").slice(0, 2);

  const modules: { key: string; header: string; body: string; icon: LinkIcon; assetId?: string | null; url: string }[] = [];
  if (props.websiteUrl) {
    modules.push({ key: "website", header: "Sitio web", body: hostOf(props.websiteUrl), icon: "globe", url: props.websiteUrl });
  }
  if (props.contactUrl) {
    modules.push({ key: "contact", header: "Guardar contacto", body: "", icon: "contact", url: props.contactUrl });
  }
  for (const link of props.links) {
    modules.push({ key: link.id, header: link.label || "Botón", body: hostOf(link.url), icon: link.icon, assetId: link.iconAssetId, url: link.url });
  }
  for (const valueModule of config.valueModules) {
    modules.push({
      key: valueModule.id,
      header: valueModule.header,
      body: valueModule.body,
      icon: valueModule.icon,
      assetId: valueModule.imageKind === "asset" ? valueModule.assetId : null,
      url: valueModule.url,
    });
  }

  const textModules: { header: string; body: string }[] = [];
  if (config.showLatest) textModules.push({ header: "Último mensaje", body: props.message });
  if (config.showDescription && props.description) textModules.push({ header: "Acerca de", body: props.description });
  if (config.showCustomFields) {
    for (const field of props.customFields ?? []) textModules.push({ header: field.label, body: field.value });
  }
  for (const textModule of config.textModules) textModules.push({ header: textModule.header, body: textModule.body });

  return (
    <div
      className="w-full max-w-sm overflow-hidden rounded-2xl shadow-lg"
      style={{ background: props.bgColor, color: props.fgColor, fontFamily: fontStack(props.fontFamily) }}
      aria-label="Vista previa de Google Wallet"
    >
      <div className="flex items-center gap-3 p-4">
        {props.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.logoUrl} alt="" className="h-10 max-w-[60%] object-contain object-left" />
        ) : (
          <>
            {props.iconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.iconUrl} alt="" className="h-8 w-8 rounded-full" />
            )}
            <span className="truncate font-semibold">{props.organizationName || "Tu negocio"}</span>
          </>
        )}
      </div>
      {hero && <div className="h-24 w-full" style={{ backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, backgroundSize: "cover", backgroundPosition: style.backgroundPosition }} />}
      <div className="space-y-3 p-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
            {props.organizationName}
          </div>
          <div className="text-xl font-semibold">{props.name || "Nombre de la tarjeta"}</div>
        </div>

        {config.showLatest && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
              Latest
            </div>
            <div className="text-sm">{props.message || "Sin mensajes todavía"}</div>
          </div>
        )}
        {frontFields.map((field) => (
          <div key={field.id}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
              {field.label}
            </div>
            <div className="text-sm">{field.value}</div>
          </div>
        ))}

        {mode === "text" && config.code.text && (
          <div className="rounded-lg bg-black/20 px-3 py-2 text-center font-mono text-sm">{config.code.text}</div>
        )}
        {mode === "code" &&
          (props.qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.qrUrl} alt="QR code" className="mx-auto h-20 w-20 rounded bg-white p-1" />
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded bg-white text-[10px] font-semibold uppercase text-gray-500">QR</div>
          ))}

        {config.button && (
          <div className="rounded-lg px-3 py-2 text-center text-sm font-medium" style={{ background: props.accentColor, color: accentText(props.accentColor) }}>
            {config.button.label || "Botón"}
          </div>
        )}

        {modules.length > 0 && (
          <div className="space-y-2">
            {modules.map((module) => (
              <div key={module.key} className="flex items-center gap-3 rounded-lg px-2 py-1.5" style={{ background: "rgba(127,127,127,0.12)" }}>
                <ModuleIcon icon={module.icon} assetId={module.assetId} cardId={props.cardId} accent={props.accentColor} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{module.header}</div>
                  {module.body && (
                    <div className="truncate text-xs" style={{ color: props.labelColor }}>
                      {module.body}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {textModules.length > 0 && (
          <div className="space-y-2 border-t border-white/10 pt-2">
            {textModules.map((module, index) => (
              <div key={`${module.header}-${index}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
                  {module.header}
                </div>
                <div className="text-sm">{module.body}</div>
              </div>
            ))}
          </div>
        )}

        {config.imageModule?.assetId && props.cardId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/cards/${props.cardId}/asset/${config.imageModule.assetId}`} alt={config.imageModule.description} className="w-full rounded-lg object-cover" />
        )}

        <p className="text-[10px] uppercase tracking-wide" style={{ color: props.labelColor }}>
          Vista previa de Google Wallet · el diseño real puede variar
        </p>
      </div>
    </div>
  );
}
