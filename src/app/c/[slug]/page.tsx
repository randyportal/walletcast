import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { userAgent } from "next/server";
import { getServices } from "@/lib/services";
import { imageUrl } from "@/lib/google/objects";
import { normaliseSource } from "@/lib/cards/links";
import { contrastRatio, hexToRgba } from "@/lib/cards/design";
import { faviconIcons } from "@/lib/cards/favicon";
import { glowSlot, slotHue } from "@/lib/glow/hue";
import { PublicCardHero } from "@/components/PublicCardHero";

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
  const emailMode = !card.askEmail ? "off" : card.emailRequired ? "required" : "optional";
  const heroGlow = card.dayGlow ? slotHue(glowSlot(new Date(), config.glowTimeZone)) : null;

  const addForm = buttons.length > 0 && (
    <form method="post" className="space-y-4">
      {source && <input type="hidden" name="src" value={source} />}
      <div className="text-center">
        <h2 className="text-lg font-bold tracking-tight">Agrega la tarjeta a tu teléfono</h2>
        <p className="mt-1 text-sm text-muted">Un toque y queda guardada. Sin app y sin cuenta.</p>
      </div>
      {emailMode !== "off" && (
        <label className="block">
          <span className="field-label">
            Correo electrónico {emailMode === "optional" && <span className="font-normal text-muted">(opcional)</span>}
          </span>
          <input
            name="email"
            type="email"
            className="input"
            placeholder="tu@correo.com"
            autoComplete="email"
            required={emailMode === "required"}
            aria-required={emailMode === "required"}
          />
          {emailMode === "required" && <p className="field-hint">Necesitamos tu correo para agregar la tarjeta.</p>}
        </label>
      )}
      <div className="space-y-2">
        {buttons.map((b, i) => (
          <button
            key={b.key}
            formAction={b.action}
            className="min-h-12 w-full rounded-2xl px-4 py-3 text-base font-semibold shadow-sm transition-transform active:scale-[0.99]"
            style={
              i === 0
                ? { background: card.accentColor, color: accentText(card.accentColor) }
                : { border: "1px solid var(--border)", color: "var(--foreground)", background: "transparent" }
            }
          >
            {b.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error === "429"
            ? "Demasiados intentos. Inténtalo de nuevo en un minuto."
            : error === "400"
              ? emailMode === "required"
                ? "Revisa el correo electrónico: es obligatorio y debe ser válido."
                : "Ese correo no parece válido."
              : "Algo salió mal. Inténtalo de nuevo."}
        </p>
      )}
    </form>
  );

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-background px-4 py-8 sm:py-12">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: `radial-gradient(72% 55% at 50% 0%, ${hexToRgba(card.accentColor, 0.2)}, transparent 68%)` }}
      />
      <div className="w-full max-w-md space-y-4">
        <PublicCardHero
          organizationName={card.organizationName}
          name={card.name}
          description={minimal ? "" : card.description}
          welcomeText={minimal ? "" : card.welcomeText}
          nameLabel={card.nameLabel}
          logoText={card.logoText}
          headerLabel={card.headerLabel}
          headerValue={card.headerValue}
          logoUrl={card.logo ? imageUrl("", card, "logo") : null}
          iconUrl={imageUrl("", card, "icon")}
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
          backgroundImageUrl={card.backgroundImage ? `/api/cards/${card.id}/image/background?v=${card.updatedAt.getTime()}` : null}
          fontFamily={card.fontFamily}
          glowHue={heroGlow}
          compact={minimal}
        />

        {addForm || (
          <section className="panel p-5 text-center">
            <h2 className="text-lg font-bold tracking-tight">Muy pronto podrás agregar esta tarjeta</h2>
            <p className="mt-1 text-sm text-muted">Estamos terminando de configurar Apple Wallet y Google Wallet para esta tarjeta.</p>
          </section>
        )}

        <footer className="pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Travel Portal Wallet Card
        </footer>
      </div>
    </main>
  );
}
