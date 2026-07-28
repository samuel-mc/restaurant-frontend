/**
 * Contraste WCAG para fills de marca del menú (CTAs / header).
 * Si el accent del tenant no alcanza 4.5:1 con blanco ni tinta,
 * lo remapeamos hacia negro o blanco preservando el matiz.
 */

const WHITE = "#ffffff";
const INK = "#171717";
/** AA texto normal / labels en botones. */
const MIN_CONTRAST = 4.5;

export type MenuAccentPair = {
  /** Fill usable en CTAs y header. */
  accent: string;
  /** Texto/icono sobre el fill. */
  foreground: string;
};

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(raw)) return null;
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const channel = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa WCAG (0–1). */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** Ratio de contraste WCAG (≥1). */
export function contrastRatio(hexA: string, hexB: string): number {
  const L1 = relativeLuminance(hexA);
  const L2 = relativeLuminance(hexB);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixHex(from: string, toward: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(toward);
  if (!a || !b) return from;
  const u = Math.min(1, Math.max(0, t));
  return toHex(
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  );
}

function adjustUntil(
  hex: string,
  toward: string,
  against: string,
  minRatio: number,
): string | null {
  let best: string | null = null;
  for (let step = 1; step <= 24; step += 1) {
    const candidate = mixHex(hex, toward, step / 24);
    if (contrastRatio(candidate, against) >= minRatio) {
      best = candidate;
      break;
    }
  }
  return best;
}

function normalizeHex(hex: string): string | null {
  const trimmed = hex.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!parseHex(withHash)) return null;
  return withHash.toLowerCase();
}

/**
 * Elige fill + foreground legibles para CTAs del menú.
 * Preferencia: conservar el HEX del tenant si ya cumple; si no, remap mínimo.
 */
export function resolveMenuAccentPair(hex: string): MenuAccentPair {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return { accent: INK, foreground: WHITE };
  }

  const againstWhite = contrastRatio(normalized, WHITE);
  const againstInk = contrastRatio(normalized, INK);

  if (againstWhite >= MIN_CONTRAST || againstInk >= MIN_CONTRAST) {
    return {
      accent: normalized,
      foreground: againstWhite >= againstInk ? WHITE : INK,
    };
  }

  const darkened = adjustUntil(normalized, "#000000", WHITE, MIN_CONTRAST);
  const lightened = adjustUntil(normalized, "#ffffff", INK, MIN_CONTRAST);

  if (darkened && lightened) {
    const originL = relativeLuminance(normalized);
    const darkDist = Math.abs(relativeLuminance(darkened) - originL);
    const lightDist = Math.abs(relativeLuminance(lightened) - originL);
    return darkDist <= lightDist
      ? { accent: darkened, foreground: WHITE }
      : { accent: lightened, foreground: INK };
  }
  if (darkened) return { accent: darkened, foreground: WHITE };
  if (lightened) return { accent: lightened, foreground: INK };

  return { accent: INK, foreground: WHITE };
}
