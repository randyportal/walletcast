import type { Card } from "@/lib/db/schema";

export function faviconUrl(card: Pick<Card, "id" | "updatedAt">): string {
  return `/api/cards/${card.id}/image/favicon?v=${card.updatedAt.getTime()}`;
}

export function faviconIcons(card: Pick<Card, "id" | "updatedAt">) {
  const url = faviconUrl(card);
  return {
    icon: [{ url, type: "image/png", sizes: "180x180" }],
    shortcut: url,
    apple: [{ url, sizes: "180x180", type: "image/png" }],
  };
}
