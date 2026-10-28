import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { requirePlatformAdmin } from "@/server/auth";
import { switchOrganizationAction } from "@/server/actions";
import { OrganizationForm } from "@/components/OrganizationForm";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Organizaciones" };

export default async function OrganizationsPage() {
  await requirePlatformAdmin();
  const { organizations } = await getServices();
  const list = await organizations.listAll();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Plataforma</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Organizaciones</h1>
          <p className="mt-2 text-sm text-muted">Crea negocios y cambia de contexto para administrarlos.</p>
        </div>
      </div>

      <section className="panel">
        <h2 className="mb-4 text-xl font-bold tracking-tight">Nueva organización</h2>
        <OrganizationForm />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((org) => (
          <article key={org.id} className="panel flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Glyph path={UI_ICON_PATHS.building} size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-bold">{org.name}</h2>
                <p className="truncate text-xs text-muted">/{org.slug}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge">{org.currency}</span>
              <span className="badge">{org.timeZone}</span>
            </div>
            <div className="mt-auto flex items-center gap-2">
              <form action={switchOrganizationAction}>
                <input type="hidden" name="organizationId" value={org.id} />
                <button className="btn-primary px-3 py-1.5 text-xs">Entrar</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
