import { cardBackgroundStyle, hexToRgba } from "@/lib/cards/design";
import { fontStack } from "@/lib/cards/fonts";
import { Glyph, UI_ICON_PATHS } from "./icons";

export interface PublicCardHeroProps {
  organizationName: string;
  name: string;
  description?: string;
  welcomeText?: string;
  nameLabel?: string;
  logoText?: string;
  headerLabel?: string;
  headerValue?: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
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
  glowHue?: number | null;
  compact?: boolean;
}

export function PublicCardHero(props: PublicCardHeroProps) {
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
  const tagline =
    props.description ||
    props.welcomeText ||
    "Agrega tu tarjeta y recibe novedades directamente en tu teléfono.";
  const kicker = props.nameLabel || props.organizationName;
  const glow = props.glowHue != null
    ? `radial-gradient(120% 90% at 50% -20%, hsl(${Math.round((((props.glowHue % 1) + 1) % 1) * 360)} 75% 66% / 0.45), transparent 62%)`
    : null;

  return (
    <section
      className="relative w-full overflow-hidden rounded-[2rem] border p-6 text-center shadow-2xl sm:p-8"
      style={{
        ...style,
        color: props.fgColor,
        borderColor: hexToRgba(props.fgColor, 0.16),
        boxShadow: `0 32px 90px -38px ${hexToRgba(props.accentColor, 0.65)}`,
      }}
      aria-label={`Tarjeta ${props.name}`}
    >
      {glow && <div className="pointer-events-none absolute inset-0" style={{ background: glow }} />}
      <div className="relative z-10 flex flex-col items-center">
        {props.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.logoUrl} alt="" className="mx-auto h-16 max-w-[78%] object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {props.iconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.iconUrl} alt="" className="h-14 w-14 rounded-2xl object-cover shadow-sm" />
            )}
            <span className="text-sm font-semibold">{props.logoText || props.organizationName}</span>
          </div>
        )}

        <span
          className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ background: hexToRgba(props.fgColor, 0.1), color: props.labelColor }}
        >
          <Glyph path={UI_ICON_PATHS.wallet} size={13} /> Tarjeta digital
        </span>

        {props.headerValue && (
          <span className="mt-3 rounded-full px-3 py-1 text-[11px] font-medium" style={{ background: hexToRgba(props.fgColor, 0.08), color: props.labelColor }}>
            {props.headerLabel ? `${props.headerLabel}: ` : ""}{props.headerValue}
          </span>
        )}

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: props.labelColor }}>
          {kicker}
        </p>
        <h1
          className="mt-2 max-w-full text-balance break-words text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
          style={{ fontFamily: fontStack(props.fontFamily) }}
        >
          {props.name}
        </h1>
        {!props.compact && <p className="mt-3 max-w-sm text-sm leading-relaxed opacity-85">{tagline}</p>}

        {!props.compact && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["Sin app", "Sin cuenta", "Notificaciones"].map((benefit) => (
              <span
                key={benefit}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
                style={{ background: hexToRgba(props.fgColor, 0.08), color: props.labelColor }}
              >
                <Glyph path={UI_ICON_PATHS.check} size={12} /> {benefit}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
