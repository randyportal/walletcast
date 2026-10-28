import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Travel Portal Wallet Card", template: "%s · Travel Portal Wallet Card" },
  description: "Envía notificaciones a la pantalla de bloqueo mediante pases de Apple Wallet y Google Wallet. Sin app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
