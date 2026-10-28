import { requireUser } from "@/server/auth";
import { DashboardNav } from "@/components/DashboardNav";
import { getServices } from "@/lib/services";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const { organizations } = await getServices();
  const memberships = await organizations.listForUser(user.id);
  return (
    <div className="min-h-dvh md:pl-64">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <DashboardNav
        name={user.name}
        username={user.username}
        organizationRole={user.organizationRole}
        isPlatformAdmin={user.isPlatformAdmin}
        organizations={memberships.map((org) => ({ id: org.id, name: org.name, role: org.role }))}
        activeOrganizationId={user.organizationId}
      />
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}
