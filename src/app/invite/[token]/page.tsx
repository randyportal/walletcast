import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getCurrentUser } from "@/server/auth";
import { acceptInvitationAction } from "@/server/actions";
import { InviteSignupForm } from "./InviteSignupForm";

export const metadata: Metadata = { title: "Aceptar invitación" };

const roleLabel: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  marketing: "Marketing",
  staff: "Staff",
  viewer: "Viewer",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const { organizations, users } = await getServices();
  const invitation = await organizations.findInvitation(token);
  const user = await getCurrentUser();

  const invalid = !invitation || invitation.acceptedAt || invitation.expired;
  const existingAccount = invitation ? Boolean(await users.findByIdentifier(invitation.email)) : false;
  const mismatch = Boolean(invitation && user && (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()));
  const organization = invitation ? await organizations.findById(invitation.organizationId) : null;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]" />
      <div className="panel w-full max-w-md space-y-5 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Invitación</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Únete a {organization?.name ?? "la organización"}</h1>
          <p className="mt-1 text-sm text-muted">
            {invitation
              ? `Invitación para ${invitation.email} con el rol de ${roleLabel[invitation.role] ?? invitation.role}.`
              : "Esta invitación ya no está disponible."}
          </p>
        </div>

        {(error === "invalid" || invalid) && (
          <p className="text-sm text-danger">La invitación no es válida, ya fue usada o expiró. Pide una nueva.</p>
        )}
        {(error === "email" || mismatch) && (
          <p className="text-sm text-danger">
            Esta invitación es para {invitation?.email}. Inicia sesión con ese correo para aceptarla.
          </p>
        )}

        {!invalid && !mismatch && !user && existingAccount && (
          <Link className="btn-primary inline-flex" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
            Iniciar sesión para aceptar
          </Link>
        )}

        {!invalid && !mismatch && !user && !existingAccount && invitation && (
          <InviteSignupForm token={token} email={invitation.email} />
        )}

        {!invalid && !mismatch && user && (
          <form action={acceptInvitationAction.bind(null, token)}>
            <button type="submit" className="btn-primary">
              Aceptar invitación
            </button>
          </form>
        )}

        <Link className="text-sm text-muted underline" href="/login">
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  );
}
