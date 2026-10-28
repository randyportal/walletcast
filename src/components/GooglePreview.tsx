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
import { type ContentConfig, type HistoryMessage, historyText } from "@/lib/cards/content";
import { LINK_ICON_PATHS } from "@/lib/cards/icon-paths";
import { Glyph } from "./icons";

export interface GooglePreviewProps {
  organizationName: string;
  name: string;
  latestLabel?: string;
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
  contentConfig: ContentConfig;
  history?: HistoryMessage[];
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
  background,
}: {
  icon: LinkIcon;
  assetId?: string | null;
  cardId?: string;
  background: string;
}) {
  const foreground = accentText(background);
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background }}>
      {assetId && cardId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/cards/${cardId}/asset/${assetId}`} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <span style={{ color: foreground }}>
          <Glyph path={LINK_ICON_PATHS[icon]} size={16} />
        </span>
      )}
    </span>
  );
}

export function GooglePreview(props: GooglePreviewProps) {
  const config = normalizeGoogleConfig(props.googleConfig);
  const iconBackground = props.contentConfig.recommendations.iconBackground || props.accentColor;
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
  const mode = !props.barcode ? (config.code.mode === "text" ? "text" : "hidden") : config.code.mode === "auto" ? "code" : config.code.mode;
  const frontFields = (props.customFields ?? []).filter((f) => f.location === "front").slice(0, 2);

  const modules: { key: string; header: string; body: string; icon: LinkIcon; assetId?: string | null; url: string }[] = [];
  for (const link of props.links) {
    modules.push({
      key: link.id,
      header: link.label || "Recomendación",
      body: link.subtitle || hostOf(link.url),
      icon: link.icon,
      assetId: link.iconAssetId,
      url: link.url,
    });
  }

  const textModules: { header: string; body: string }[] = [];
  if (props.contentConfig.latest.show) textModules.push({ header: props.latestLabel || "Último mensaje", body: props.message });
  if (props.contentConfig.latest.showHistory && (props.history?.length ?? 0) > 0) {
    textModules.push({
      header: props.contentConfig.latest.historyTitle,
      body: historyText(props.history ?? [], props.contentConfig.latest.historyLimit).slice(0, 500),
    });
  }
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

        {props.contentConfig.latest.show && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
              {props.latestLabel || "Último mensaje"}
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
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
              {props.contentConfig.recommendations.title}
            </div>
            {modules.map((module) => (
              <div key={module.key} className="flex items-center gap-3 rounded-lg px-2 py-1.5" style={{ background: "rgba(127,127,127,0.12)" }}>
                <ModuleIcon icon={module.icon} assetId={module.assetId} cardId={props.cardId} background={iconBackground} />
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
