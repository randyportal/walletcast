import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServices } from "@/lib/services";
import { publicCardUrl } from "@/lib/cards/links";
import { GOOGLE_DAILY_NOTIFICATION_LIMIT } from "@/lib/broadcast/broadcast";
import { imageUrl } from "@/lib/google/objects";
import { glowSlot, slotHue } from "@/lib/glow/hue";
import { normalizeGoogleConfig } from "@/lib/cards/google";
import { normalizeAppleConfig } from "@/lib/cards/apple";
import { normalizeContent } from "@/lib/cards/content";
import { CardForm } from "@/components/CardForm";
import { SendForm } from "@/components/SendForm";
import { QrPanel } from "@/components/QrPanel";
import { deleteCardAction, sendMessageAction, syncGoogleCardAction, updateCardAction } from "@/server/actions";
import { requireAdmin } from "@/server/auth";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";
import Link from "next/link";

export const metadata: Metadata = { title: "Tarjeta" };

const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export default async function CardPage({ params, searchParams }: PageProps<"/dashboard/cards/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { googleSynced, googleError, googleWarn } = await searchParams;
  const { config, cards, subscribers } = await getServices();
  const card = await cards.findById(id);
  if (!card) notFound();

  const [stats, history, sources] = await Promise.all([
    cards.listWithStats().then((all) => all.find((c) => c.id === id)),
    cards.listMessages(id, 20),
    subscribers.countBySource(id),
  ]);
  const apple = stats?.appleSubscribers ?? 0;
  const google = stats?.googleSubscribers ?? 0;
  const link = publicCardUrl(config.baseUrl, card.slug);
  const content = normalizeContent(card);
  const now = new Date();
  const googleToday = await cards.countMessagesSince(card.id, new Date(now.getTime() - 24 * 3600_000));
  const googleRemaining = Math.max(0, GOOGLE_DAILY_NOTIFICATION_LIMIT - googleToday);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
          <Glyph path={UI_ICON_PATHS.chevronLeft} size={16} /> Tarjetas
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{card.organizationName}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{card.name}</h1>
            <p className="mt-2 text-sm text-muted">Diseño, recomendaciones y notificaciones de esta tarjeta.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={link} target="_blank" className="btn-secondary" rel="noreferrer">
              Abrir página pública <Glyph path={UI_ICON_PATHS.external} size={15} />
            </a>
            {config.google && (
              <form action={syncGoogleCardAction.bind(null, card.id)}>
                <button className="btn-secondary">
                  <Glyph path={UI_ICON_PATHS.refresh} size={15} /> Sincronizar Google
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {googleSynced === "1" && <p role="status" className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">Pases de Google actualizados.</p>}
      {googleError === "not-configured" && <p className="text-sm text-warning">Google Wallet no está configurado en este servidor.</p>}
      {typeof googleWarn === "string" && <p className="text-sm text-warning">{googleWarn}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-1 text-lg font-semibold">Enviar una notificación</h2>
          <p className="mb-4 text-sm text-muted">
            Aparece en la pantalla de bloqueo de todos los que tienen la tarjeta y queda como el último mensaje.
          </p>
          <SendForm
            action={sendMessageAction.bind(null, card.id)}
            subscriberCount={apple + google}
            organizationName={card.organizationName}
            cardName={card.name}
            iconUrl={`/api/cards/${card.id}/image/icon?v=${card.updatedAt.getTime()}`}
            googleRemaining={googleRemaining}
            lastMessage={card.latestMessage}
          />
        </section>

        <section className="panel">
          <h2 className="mb-1 text-lg font-semibold">Compartir</h2>
          <p className="mb-4 text-sm text-muted">Imprime el código QR o comparte el enlace. Se agrega con un toque.</p>
          <QrPanel cardId={card.id} baseLink={link} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel">
          <h2 className="mb-4 text-lg font-semibold">Suscriptores</h2>
          <p className="text-3xl font-semibold">{apple + google}</p>
          <p className="text-sm text-muted">
            {apple} Apple Wallet · {google} Google Wallet
          </p>
          {sources.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="font-normal">Origen</th>
                  <th className="text-right font-normal">Agregados</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source ?? "direct"}>
                    <td>{s.source ?? "enlace directo"}</td>
                    <td className="text-right">{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <a href={`/api/cards/${card.id}/subscribers.csv`} className="btn-secondary mt-4">
            Exportar CSV
          </a>
        </section>

        <section className="panel lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Historial</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Aún no se ha enviado ninguna notificación.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex justify-between gap-4">
                    <p className="font-medium">{m.title}</p>
                    <p className="shrink-0 text-xs text-muted">{dateFmt.format(m.createdAt)}</p>
                  </div>
                  <p className="text-sm">{m.body}</p>
                  {m.sentBy && <p className="text-xs text-muted">Enviado por {m.sentBy}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Apple {m.appleSent}/{m.appleTargets} · Google {m.googleSent}/{m.googleTargets}
                    {m.appleFailed + m.googleFailed > 0 && ` · ${m.appleFailed + m.googleFailed} fallidos`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Editor de la tarjeta</h2>
          <p className="mt-1 text-sm text-muted">Elige una sección, edita y revisa la vista previa antes de guardar.</p>
        </div>
        <CardForm
          action={updateCardAction.bind(null, card.id)}
          submitLabel="Guardar cambios"
          latestMessage={card.latestMessage}
          qrUrl={`/api/cards/${card.id}/qr?src=pass`}
          glowHue={slotHue(glowSlot(new Date(), config.glowTimeZone))}
          existingLogoUrl={card.logo ? imageUrl("", card, "logo") : null}
          existingIconUrl={imageUrl("", card, "icon")}
          existingBackgroundUrl={card.backgroundImage ? `/api/cards/${card.id}/image/background?v=${card.updatedAt.getTime()}` : null}
          existingFaviconUrl={card.favicon ? `/api/cards/${card.id}/image/favicon?v=${card.updatedAt.getTime()}` : null}
          existingAppleImageUrl={card.appleImage ? `/api/cards/${card.id}/image/apple-image?v=${card.updatedAt.getTime()}` : null}
          cardId={card.id}
          initial={{
            name: card.name,
            organizationName: card.organizationName,
            slug: card.slug,
            description: card.description,
            welcomeText: card.welcomeText,
            websiteUrl: card.websiteUrl ?? "",
            bgColor: card.bgColor,
            fgColor: card.fgColor,
            labelColor: card.labelColor,
            accentColor: card.accentColor,
            backgroundType: card.backgroundType,
            bgColor2: card.bgColor2 ?? "",
            gradientAngle: card.gradientAngle,
            backgroundOverlay: card.backgroundOverlay,
            backgroundOverlayColor: card.backgroundOverlayColor,
            backgroundPosition: card.backgroundPosition,
            fontFamily: card.fontFamily,
            iconSource: card.iconSource,
            iconPreset: card.iconPreset,
            iconShape: card.iconShape,
            monogramText: card.monogramText,
            latestLabel: card.latestLabel,
            contactUrl: card.contactUrl ?? "",
            logoText: card.logoText,
            headerLabel: card.headerLabel,
            headerValue: card.headerValue,
            nameLabel: card.nameLabel,
            barcode: card.barcode,
            barcodeType: card.barcodeType,
            barcodeContent: card.barcodeContent,
            barcodeValue: card.barcodeValue ?? "",
            dayGlow: card.dayGlow,
            links: content.links,
            customFields: card.customFields,
            googleConfig: { ...normalizeGoogleConfig(card.googleConfig), valueModules: [] },
            appleConfig: normalizeAppleConfig(card.appleConfig),
            contentConfig: content.config,
            publicPageMode: card.publicPageMode,
            askEmail: card.askEmail,
          }}
        />
      </section>

      <section className="panel border-danger/40">
        <h2 className="mb-1 text-lg font-semibold">Eliminar tarjeta</h2>
        <p className="mb-4 text-sm text-muted">
          Elimina la tarjeta, sus suscriptores y el historial. Los pases que ya están en las carteras dejan de actualizarse.
        </p>
        <form action={deleteCardAction.bind(null, card.id)}>
          <button className="btn-danger">Eliminar permanentemente</button>
        </form>
      </section>
    </div>
  );
}
