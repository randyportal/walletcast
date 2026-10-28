import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="badge w-fit">Código abierto · autoalojado</p>
      <h1 className="text-4xl font-semibold tracking-tight">Travel Portal Wallet Card</h1>
      <p className="text-lg text-muted">
        Pon una tarjeta en Apple Wallet o Google Wallet de tus clientes con un toque y envíales
        notificaciones a la pantalla de bloqueo cuando quieras. Sin crear ni instalar una app.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard" className="btn-primary">
          Abrir panel
        </Link>
        <a href="https://github.com/randyportal/walletcast" className="btn-secondary">
          Código fuente
        </a>
      </div>
    </main>
  );
}
