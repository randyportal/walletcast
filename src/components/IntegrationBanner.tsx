import Link from "next/link";
import type { AppConfig } from "@/lib/config/env";

export function IntegrationBanner({ config }: { config: AppConfig }) {
  const missing = [!config.apple && "Apple Wallet", !config.google && "Google Wallet"].filter(Boolean);
  if (missing.length === 0 && config.warnings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
      {missing.length > 0 && (
        <p>
          <strong>{missing.join(" y ")}</strong> {missing.length > 1 ? "no están configurados" : "no está configurado"} todavía, así que esos botones están ocultos en tus páginas públicas.{" "}
          <Link href="/dashboard/settings" className="font-semibold underline underline-offset-2">
            Cómo configurarlo
          </Link>
        </p>
      )}
      {config.warnings.map((w) => (
        <p key={w} className="mt-1 text-warning">
          {w}
        </p>
      ))}
    </div>
  );
}
