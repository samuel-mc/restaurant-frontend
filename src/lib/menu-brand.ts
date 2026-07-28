import type { CSSProperties } from "react";
import type { RestaurantProfile } from "@/types/api";
import { resolveMenuAccentPair } from "@/lib/color-contrast";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Tokens de marca del menú / tracking comensal desde el perfil público.
 * Usa `primaryColor` (y `secondaryColor` como soft) con contraste WCAG.
 */
export function brandFromProfile(profile: RestaurantProfile | null): {
  accent: string | null;
  style: CSSProperties;
} {
  const primary = profile?.primaryColor?.trim() ?? "";
  const secondary = profile?.secondaryColor?.trim() ?? "";
  const accentRaw = HEX.test(primary) ? primary : null;
  const soft = HEX.test(secondary) ? secondary : accentRaw;

  if (!accentRaw) {
    return {
      accent: null,
      style: {
        ["--menu-accent" as string]: "var(--foreground)",
        ["--menu-accent-fg" as string]: "var(--background)",
        ["--menu-accent-muted" as string]:
          "color-mix(in srgb, var(--foreground) 12%, transparent)",
        ["--menu-accent-soft" as string]: "var(--muted)",
        ["--menu-accent-wash" as string]: "var(--background)",
      },
    };
  }

  const { accent, foreground } = resolveMenuAccentPair(accentRaw);

  return {
    accent,
    style: {
      ["--menu-accent" as string]: accent,
      ["--menu-accent-fg" as string]: foreground,
      ["--menu-accent-muted" as string]:
        `color-mix(in srgb, ${accent} 14%, transparent)`,
      ["--menu-accent-soft" as string]: soft ?? accent,
      ["--menu-accent-wash" as string]:
        `color-mix(in srgb, ${accent} 6%, var(--background))`,
    },
  };
}
