import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Glyph, UI_ICON_PATHS } from "@/components/icons";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]" />
      <div className="panel w-full max-w-sm space-y-6 p-6">
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
            <Glyph path={UI_ICON_PATHS.wallet} size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Travel Portal Wallet Card</h1>
            <p className="mt-1 text-sm text-muted">Inicia sesión en tu panel.</p>
          </div>
        </div>
        <LoginForm next={typeof next === "string" ? next : "/dashboard"} />
      </div>
    </main>
  );
}
