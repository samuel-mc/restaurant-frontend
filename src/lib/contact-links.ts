/**
 * Utilidades de contacto / mapas a partir del perfil público.
 */

const GOOGLE_MAPS_HOSTS = new Set([
  "www.google.com",
  "maps.google.com",
  "google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

/** Normaliza un teléfono a dígitos (para wa.me / tel:). */
export function digitsOnlyPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

/** URL de chat de WhatsApp, o `null` si no hay número usable. */
export function whatsappChatUrl(
  whatsapp: string | null | undefined,
  options?: { text?: string },
): string | null {
  const digits = digitsOnlyPhone(whatsapp);
  if (digits.length < 8) return null;
  const base = `https://wa.me/${digits}`;
  const text = options?.text?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** `tel:` href, o `null`. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = digitsOnlyPhone(phone);
  if (digits.length < 8) return null;
  return `tel:+${digits}`;
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

/** True si la URL es un link de Google Maps (allowlist de hosts). */
export function isAllowedGoogleMapsUrl(
  googleMapsUrl: string | null | undefined,
): boolean {
  if (!googleMapsUrl?.trim()) return false;
  const url = parseHttpUrl(googleMapsUrl);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const bare = host.startsWith("www.") ? host.slice(4) : host;
  if (
    !GOOGLE_MAPS_HOSTS.has(host) &&
    !GOOGLE_MAPS_HOSTS.has(bare) &&
    !host.endsWith(".google.com")
  ) {
    return false;
  }
  const path = url.pathname.toLowerCase();
  const looksLikeMaps =
    path.includes("/maps") ||
    host.includes("maps") ||
    host === "goo.gl" ||
    host === "maps.app.goo.gl";
  return looksLikeMaps;
}

/**
 * Si la URL ya es un embed de Google Maps en un host allowlisteado, la usa en iframe.
 * Si no, devuelve `null` (mostrar enlace externo o nada).
 */
export function mapsEmbedSrc(
  googleMapsUrl: string | null | undefined,
): string | null {
  if (!isAllowedGoogleMapsUrl(googleMapsUrl)) return null;
  const url = googleMapsUrl!.trim();
  if (!url.includes("/maps/embed")) return null;
  return url;
}

/** Href seguro para “Abrir en Google Maps”, o `null`. */
export function mapsExternalHref(
  googleMapsUrl: string | null | undefined,
): string | null {
  if (!isAllowedGoogleMapsUrl(googleMapsUrl)) return null;
  return googleMapsUrl!.trim();
}
