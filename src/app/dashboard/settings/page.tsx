import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { APPLE_WEB_SERVICE_PATH } from "@/lib/apple/pass";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Ajustes" };

const DOCS = "https://github.com/randyportal/walletcast/blob/main/docs";

function Status({ ok }: { ok: boolean }) {
  return <span className={`badge ${ok ? "text-success" : "text-warning"}`}>{ok ? "Conectado" : "Sin configurar"}</span>;
}

export default async function SettingsPage() {
  await requireAdmin();
  const { config } = await getServices();
  const rows: [string, string][] = [
    ["URL pública (BASE_URL)", config.baseUrl],
    ["Base de datos", config.databaseUrl ? "PostgreSQL (DATABASE_URL)" : `Embedded PGlite (${config.pgliteDir})`],
    ["Servicio web de Apple", `${config.baseUrl}${APPLE_WEB_SERVICE_PATH}`],
  ];
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <p className="text-sm text-muted">
        Travel Portal Wallet Card se configura con variables de entorno, así que los secretos nunca se guardan en la base de datos. Cámbialos en tu servidor (Vercel, Docker, .env.local) y reinicia.
      </p>

      <section className="panel space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Apple Wallet</h2>
          <Status ok={Boolean(config.apple)} />
        </div>
        {config.apple ? (
          <p className="text-sm text-muted">
            Tipo de pase <code>{config.apple.passTypeId}</code> · Equipo <code>{config.apple.teamId}</code>
          </p>
        ) : (
          <p className="text-sm text-muted">
            Requiere una cuenta de Apple Developer (99 USD/año), un certificado Pass Type ID y el certificado WWDR.{" "}
            <a className="underline" href={`${DOCS}/setup-apple.md`}>
              Guía paso a paso
            </a>
          </p>
        )}
      </section>

      <section className="panel space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Google Wallet</h2>
          <Status ok={Boolean(config.google)} />
        </div>
        {config.google ? (
          <p className="text-sm text-muted">
            Emisor <code>{config.google.issuerId}</code> · {config.google.serviceAccount.client_email}
          </p>
        ) : (
          <p className="text-sm text-muted">
            Gratis. Requiere una cuenta de emisor de Google Wallet y una cuenta de servicio de Google Cloud.{" "}
            <a className="underline" href={`${DOCS}/setup-google.md`}>
              Guía paso a paso
            </a>
          </p>
        )}
        <p className="text-xs text-muted">
          Google muestra como máximo unas 3 notificaciones por pase cada 24 horas. Los mensajes extra actualizan la tarjeta sin notificar.
        </p>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-lg font-semibold">Servidor</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-[220px_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="break-all font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
        {config.warnings.length > 0 && (
          <ul className="mt-4 list-disc pl-5 text-sm text-warning">
            {config.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
