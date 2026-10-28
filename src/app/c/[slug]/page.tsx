import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { userAgent } from "next/server";
import { getServices } from "@/lib/services";
import { imageUrl } from "@/lib/google/objects";
import { latestMessageText } from "@/lib/apple/pass";
import { normaliseSource } from "@/lib/cards/links";
import { cardBackgroundStyle, contrastRatio } from "@/lib/cards/design";
import { fontStack } from "@/lib/cards/fonts";
import { faviconIcons } from "@/lib/cards/favicon";
import { LINK_ICON_PATHS } from "@/lib/cards/icon-paths";
import { glowSlot, slotHue } from "@/lib/glow/hue";
import { PassPreview } from "@/components/PassPreview";
import { GooglePreview } from "@/components/GooglePreview";
import { Glyph } from "@/components/icons";
import { normalizeGoogleConfig } from "@/lib/cards/google";
import { normalizeAppleConfig } from "@/lib/cards/apple";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { cards } = await getServices();
  const card = await cards.findBySlug(slug);
  return card
    ? { title: { absolute: card.name }, description: `Agrega ${card.name} a tu cartera.`, icons: faviconIcons(card) }
    : { title: "Tarjeta no encontrada" };
}

function accentText(hex: string): string {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#ffffff") ? "#000000" : "#ffffff";
}

export default async function PublicCardPage({ params, searchParams }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { src, error } = await searchParams;
  const { config, cards } = await getServices();
  const card = await cards.findBySlug(slug);
  if (!card) notFound();

  const os = userAgent({ headers: await headers() }).os.name ?? "";
  const isAndroid = /android/i.test(os);
  const isApple = /ios|mac/i.test(os);
  const source = normaliseSource(typeof src === "string" ? src : null);
  const buttons = [
    config.apple && !isAndroid && { key: "apple", label: "Agregar a Apple Wallet", action: `/api/passes/apple/${card.slug}` },
    config.google && !isApple && { key: "google", label: "Agregar a Google Wallet", action: `/api/passes/google/${card.slug}` },
  ].filter((b): b is { key: string; label: string; action: string } => Boolean(b));
  const minimal = card.publicPageMode === "minimal";

  const style = cardBackgroundStyle({
    backgroundType: card.backgroundType,
    bgColor: card.bgColor,
    bgColor2: card.bgColor2,
    gradientAngle: card.gradientAngle,
    backgroundOverlay: card.backgroundOverlay,
    backgroundOverlayColor: card.backgroundOverlayColor,
    backgroundPosition: card.backgroundPosition,
    backgroundImageUrl: card.backgroundImage ? `/api/cards/${card.id}/image/background?v=${card.updatedAt.getTime()}` : null,
  });

  const backgroundUrl = card.backgroundImage ? `/api/cards/${card.id}/image/background?v=${card.updatedAt.getTime()}` : null;
  const preview = isAndroid && config.google ? (
    <GooglePreview
      organizationName={card.organizationName}
      name={card.name}
      description={card.description}
      message={latestMessageText(card)}
      websiteUrl={card.websiteUrl ?? undefined}
      contactUrl={card.contactUrl ?? undefined}
      bgColor={card.bgColor}
      fgColor={card.fgColor}
      labelColor={card.labelColor}
      accentColor={card.accentColor}
      backgroundType={card.backgroundType}
      bgColor2={card.bgColor2}
      gradientAngle={card.gradientAngle}
      backgroundOverlay={card.backgroundOverlay}
      backgroundOverlayColor={card.backgroundOverlayColor}
      backgroundPosition={card.backgroundPosition}
      backgroundImageUrl={backgroundUrl}
      fontFamily={card.fontFamily}
      logoUrl={card.logo ? imageUrl("", card, "logo") : null}
      iconUrl={imageUrl("", card, "icon")}
      barcode={card.barcode}
      qrUrl={`/api/cards/${card.id}/qr?src=pass`}
      glowHue={card.dayGlow ? slotHue(glowSlot(new Date(), config.glowTimeZone)) : null}
      googleConfig={normalizeGoogleConfig(card.googleConfig)}
      links={minimal ? [] : card.links}
      customFields={card.customFields}
      cardId={card.id}
    />
  ) : (
    <PassPreview
      organizationName={card.organizationName}
      name={card.name}
      description={card.description}
      message={latestMessageText(card)}
      websiteUrl={card.websiteUrl ?? undefined}
      contactUrl={card.contactUrl ?? undefined}
      bgColor={card.bgColor}
      fgColor={card.fgColor}
      labelColor={card.labelColor}
      accentColor={card.accentColor}
      backgroundType={card.backgroundType}
      bgColor2={card.bgColor2}
      gradientAngle={card.gradientAngle}
      backgroundOverlay={card.backgroundOverlay}
      backgroundOverlayColor={card.backgroundOverlayColor}
      backgroundPosition={card.backgroundPosition}
      backgroundImageUrl={backgroundUrl}
      fontFamily={card.fontFamily}
      logoUrl={card.logo ? imageUrl("", card, "logo") : null}
      iconUrl={imageUrl("", card, "icon")}
      latestLabel={card.latestLabel}
      logoText={card.logoText}
      headerLabel={card.headerLabel}
      headerValue={card.headerValue}
      nameLabel={card.nameLabel}
      barcode={card.barcode}
      barcodeType={card.barcodeType}
      customFields={card.customFields}
      links={minimal ? [] : card.links}
      qrUrl={`/api/cards/${card.id}/qr?src=pass`}
      glowHue={card.dayGlow ? slotHue(glowSlot(new Date(), config.glowTimeZone)) : null}
      appleConfig={normalizeAppleConfig(card.appleConfig)}
      appleImageUrl={card.appleImage ? `/api/cards/${card.id}/image/apple-image?v=${card.updatedAt.getTime()}` : null}
    />
  );

  const addButtons = buttons.length > 0 && (
    <form method="post" className="space-y-3">
      {source && <input type="hidden" name="src" value={source} />}
      {card.askEmail && !minimal && (
        <label className="block">
          <span className="text-sm font-medium" style={{ color: card.fgColor }}>Correo (opcional)</span>
          <input name="email" type="email" className="input" placeholder="you@example.com" autoComplete="email" />
        </label>
      )}
      {buttons.map((b, i) => (
        <button
          key={b.key}
          formAction={b.action}
          className="w-full rounded-lg px-4 py-3 text-base"
          style={
            i === 0
              ? { background: card.accentColor, color: accentText(card.accentColor) }
              : { border: "1px solid currentColor", color: card.accentColor }
          }
        >
          {b.label}
        </button>
      ))}
      {error && <p className="text-center text-sm text-danger">{error === "429" ? "Demasiados intentos. Inténtalo de nuevo en un minuto." : error === "400" ? "Ese correo no parece válido." : "Algo salió mal. Inténtalo de nuevo."}</p>}
      {!minimal && card.contactUrl && (
        <a href={card.contactUrl} className="block text-center text-sm underline">
          Guardar contacto
        </a>
      )}
    </form>
  );

  return (
    <main
      className="flex flex-1 flex-col items-center px-5 py-10"
      style={{
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        backgroundPosition: style.backgroundPosition,
        color: card.fgColor,
        fontFamily: fontStack(card.fontFamily),
      }}
    >
      <div className="w-full max-w-sm space-y-6">
        {preview}

        {minimal ? (
          addButtons || (
            <p className="panel text-center text-sm" style={{ color: card.labelColor }}>
              Esta tarjeta aún no está disponible.
            </p>
          )
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-semibold">Agrega {card.name} a tu cartera</h1>
              {card.description && <p className="text-sm" style={{ color: card.labelColor }}>{card.description}</p>}
              <p className="text-xs" style={{ color: card.labelColor }}>Sin app ni cuenta. Elimina la tarjeta cuando quieras para dejar de recibir avisos.</p>
            </div>

            {buttons.length === 0 ? (
              <div className="space-y-3">
                {card.contactUrl && (
                  <a href={card.contactUrl} className="block w-full rounded-lg px-4 py-3 text-center text-base" style={{ background: card.accentColor, color: accentText(card.accentColor) }}>
                    Guardar contacto
                  </a>
                )}
                {card.websiteUrl && (
                  <a href={card.websiteUrl} className="block w-full rounded-lg border border-current px-4 py-3 text-center text-base" style={{ color: card.accentColor }}>
                    Website
                  </a>
                )}
                {!card.contactUrl && !card.websiteUrl && card.links.length === 0 && (
                  <p className="panel text-center text-sm" style={{ color: card.labelColor }}>Esta tarjeta aún no está disponible.</p>
                )}
              </div>
            ) : (
              addButtons
            )}

            {card.links.length > 0 && (
              <div className="space-y-2">
                {card.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base"
                    style={
                      link.style === "primary"
                        ? { background: card.accentColor, color: accentText(card.accentColor) }
                        : link.style === "outline"
                          ? { border: "1px solid currentColor", color: card.accentColor }
                          : { border: "1px solid currentColor", color: card.fgColor }
                    }
                  >
                    <Glyph path={LINK_ICON_PATHS[link.icon]} size={18} />
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            )}

            {card.customFields.length > 0 && (
              <div className="space-y-2 rounded-xl border border-white/10 p-4" style={{ background: "rgba(0,0,0,0.12)" }}>
                {card.customFields.map((f) => (
                  <div key={f.id} className="flex justify-between gap-4 text-sm">
                    <span style={{ color: card.labelColor }}>{f.label}</span>
                    <span className="text-right font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
