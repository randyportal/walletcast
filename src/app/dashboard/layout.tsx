import Link from "next/link";
import { logoutAction } from "@/server/actions";
import { requireUser } from "@/server/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const admin = user.role === "admin";
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3 text-sm">
          <Link href={admin ? "/dashboard" : "/dashboard/send"} className="font-semibold">
            WalletCast
          </Link>
          {admin && (
            <>
              <Link href="/dashboard" className="text-muted hover:text-foreground">
                Cards
              </Link>
              <Link href="/dashboard/send" className="text-muted hover:text-foreground">
                Send
              </Link>
              <Link href="/dashboard/settings" className="text-muted hover:text-foreground">
                Settings
              </Link>
              <Link href="/dashboard/users" className="text-muted hover:text-foreground">
                Users
              </Link>
            </>
          )}
          {!admin && (
            <Link href="/dashboard/send" className="text-muted hover:text-foreground">
              Send
            </Link>
          )}
          <div className="ml-auto flex items-center gap-4">
            <span className="text-xs text-muted">
              {user.name || user.username}
              {admin ? " · Admin" : " · Marketing"}
            </span>
            <form action={logoutAction}>
              <button className="text-muted hover:text-foreground">Sign out</button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
