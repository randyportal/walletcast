import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServices } from "@/lib/services";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Escanear tarjeta", robots: { index: false, follow: false } };

export default async function ScanEntryPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
  const { loyalty } = await getServices();
  const row = await loyalty.findByToken(token);
  if (!row) notFound();
  if (row.issuedCard.organizationId !== user.organizationId) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="panel max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Tarjeta de otra organización</h1>
          <p className="mt-2 text-sm text-muted">Esta tarjeta no pertenece a la organización activa.</p>
          <Link href="/dashboard" className="btn-secondary mt-4 inline-flex">Volver al panel</Link>
        </div>
      </main>
    );
  }
  redirect(`/dashboard/scan?card=${encodeURIComponent(token)}`);
}
