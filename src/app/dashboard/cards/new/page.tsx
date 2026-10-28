import type { Metadata } from "next";
import { CardForm } from "@/components/CardForm";
import { getConfig } from "@/lib/config/env";
import { glowSlot, slotHue } from "@/lib/glow/hue";
import { createCardAction } from "@/server/actions";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Nueva tarjeta" };

export default async function NewCardPage() {
  await requireAdmin();
  const glowHue = slotHue(glowSlot(new Date(), getConfig().glowTimeZone));
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Nueva tarjeta</h1>
      <CardForm action={createCardAction} submitLabel="Crear tarjeta" glowHue={glowHue} />
    </>
  );
}
