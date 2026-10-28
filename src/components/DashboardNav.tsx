"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/server/actions";
import { Glyph, UI_ICON_PATHS } from "./icons";

type Item = { href: string; label: string; icon: keyof typeof UI_ICON_PATHS };

export function DashboardNav({ name, username, role }: { name: string; username: string; role: string }) {
  const pathname = usePathname();
  const admin = role === "admin";
  const items: Item[] = admin
    ? [
        { href: "/dashboard", label: "Tarjetas", icon: "cards" },
        { href: "/dashboard/send", label: "Enviar", icon: "send" },
        { href: "/dashboard/settings", label: "Ajustes", icon: "settings" },
        { href: "/dashboard/users", label: "Usuarios", icon: "users" },
      ]
    : [{ href: "/dashboard/send", label: "Enviar", icon: "send" }];

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/dashboard/cards")
      : pathname === href || pathname.startsWith(`${href}/`);

  const brand = (
    <Link href={admin ? "/dashboard" : "/dashboard/send"} className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
        <Glyph path={UI_ICON_PATHS.wallet} size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tracking-tight">Travel Portal</span>
        <span className="block text-xs font-medium text-muted">Wallet Card</span>
      </span>
    </Link>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/85 px-4 py-5 backdrop-blur-xl md:flex">
        {brand}
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Navegación principal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`nav-link ${isActive(item.href) ? "nav-link-active" : ""}`}
            >
              <Glyph path={UI_ICON_PATHS[item.icon]} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <p className="truncate text-sm font-semibold">{name || username}</p>
            <p className="text-xs text-muted">{admin ? "Administrador" : "Marketing"}</p>
          </div>
          <form action={logoutAction}>
            <button className="btn-ghost w-full justify-start px-3">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {brand}
          <span className="badge">{admin ? "Administrador" : "Marketing"}</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Navegación principal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium ${isActive(item.href) ? "bg-accent/10 text-accent" : "text-muted"}`}
            >
              <Glyph path={UI_ICON_PATHS[item.icon]} size={16} />
              {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="ml-auto">
            <button className="flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-muted">Salir</button>
          </form>
        </nav>
      </header>
    </>
  );
}
