import { cardBackgroundStyle, cardUsesHero, contrastRatio, type CardField, type CardLink } from "@/lib/cards/design";
import { fontStack } from "@/lib/cards/fonts";
import { LINK_ICON_PATHS } from "@/lib/cards/icon-paths";
import { Glyph } from "./icons";

export interface PassPreviewProps {
  organizationName: string;
  name: string;
  message: string;
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
  latestLabel?: string;
  logoText?: string;
  headerLabel?: string;
  headerValue?: string;
  nameLabel?: string;
  barcode?: boolean;
  barcodeType?: string;
  customFields?: CardField[];
  links?: CardLink[];
  qrUrl?: string | null;
  glowHue?: number | null;
}

const hsl = (hue: number) => `hsl(${Math.round((((hue % 1) + 1) % 1) * 360)} 75% 66%)`;

function glowBackground(hue: number, bg: string): string {
  return [
    `linear-gradient(to bottom, transparent 45%, ${bg})`,
    `radial-gradient(50% 150% at 13% -15%, ${hsl(hue - 0.11)}, transparent)`,
    `radial-gradient(50% 150% at 53% -40%, ${hsl(hue)}, transparent)`,
    `radial-gradient(48% 150% at 90% -8%, ${hsl(hue + 0.06)}, transparent)`,
    bg,
  ].join(", ");
}

function accentText(hex: string): string {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#ffffff") ? "#000000" : "#ffffff";
}

function nameBlock(props: PassPreviewProps) {
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
        {props.nameLabel || props.organizationName}
      </div>
      <div className="text-2xl font-semibold">{props.name || "Card name"}</div>
    </>
  );
}

export function PassPreview(props: PassPreviewProps) {
  const hero = cardUsesHero({ dayGlow: props.glowHue != null, backgroundType: props.backgroundType });
  const heroStyle = cardBackgroundStyle(props);
  const font = fontStack(props.fontFamily);
  const frontFields = (props.customFields ?? []).filter((f) => f.location === "front").slice(0, 4);
  const links = props.links ?? [];

  return (
    <div className="space-y-4">
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl p-5 shadow-lg"
        style={{ background: props.bgColor, color: props.fgColor, fontFamily: font }}
        aria-label="Pass preview"
      >
        <div className="flex h-10 items-center gap-3">
          {props.logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.logoUrl} alt="" className="h-10 max-w-[60%] object-contain object-left" />
              {props.logoText && <span className="truncate font-semibold">{props.logoText}</span>}
            </>
          ) : (
            <>
              {props.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.iconUrl} alt="" className="h-8 w-8 rounded-md" />
              )}
              <span className="truncate font-semibold">{props.logoText || props.organizationName || "Your business"}</span>
            </>
          )}
          {props.headerValue && (
            <div className="ml-auto text-right leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
                {props.headerLabel}
              </div>
              <div className="text-sm">{props.headerValue}</div>
            </div>
          )}
        </div>
        {props.glowHue != null ? (
          <div
            className="-mx-5 mt-4 flex aspect-[375/123] flex-col justify-end px-5 pb-3"
            style={{ background: glowBackground(props.glowHue, props.bgColor) }}
          >
            {nameBlock(props)}
          </div>
        ) : hero ? (
          <div className="-mx-5 mt-4 flex aspect-[375/123] flex-col justify-end px-5 pb-3" style={heroStyle}>
            {nameBlock(props)}
          </div>
        ) : (
          <div className="mt-8">{nameBlock(props)}</div>
        )}
        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
            {props.latestLabel || "Latest"}
          </div>
          <div className="mt-1 text-sm leading-snug">{props.message || "You will receive updates here."}</div>
        </div>
        {frontFields.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {frontFields.map((f) => (
              <div key={f.id}>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: props.labelColor }}>
                  {f.label}
                </div>
                <div className="text-xs">{f.value}</div>
              </div>
            ))}
          </div>
        )}
        {props.barcode &&
          (props.barcodeType === "qr" && props.qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.qrUrl} alt="QR code" className="mx-auto mt-6 h-24 w-24 rounded-md bg-white p-1.5" />
          ) : (
            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-md bg-white text-center text-[10px] font-semibold uppercase text-gray-500">
              {props.barcodeType}
            </div>
          ))}
      </div>

      {links.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Public page buttons</p>
          {links.map((link: CardLink) => (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              style={
                link.style === "primary"
                  ? { background: props.accentColor, color: accentText(props.accentColor) }
                  : link.style === "outline"
                    ? { border: `1px solid ${props.accentColor}`, color: props.accentColor }
                    : { background: "rgba(127,127,127,0.15)" }
              }
            >
              <Glyph path={LINK_ICON_PATHS[link.icon]} size={16} />
              <span className="truncate">{link.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
