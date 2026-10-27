import type { FontFamily } from "./design";

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  rounded: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  condensed: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif',
};

export function fontStack(family: string | null | undefined): string {
  return FONT_STACKS[family as FontFamily] ?? FONT_STACKS.sans;
}
