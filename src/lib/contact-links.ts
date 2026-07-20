/**
 * Utilidades de contacto / mapas a partir del perfil público.
 */

/** Normaliza un teléfono a dígitos (para wa.me / tel:). */
export function digitsOnlyPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

/** URL de chat de WhatsApp, o `null` si no hay número usable. */
export function whatsappChatUrl(whatsapp: string | null | undefined): string | null {
  const digits = digitsOnlyPhone(whatsapp);
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

/** `tel:` href, o `null`. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = digitsOnlyPhone(phone);
  if (digits.length < 8) return null;
  return `tel:+${digits}`;
}

/**
 * Si la URL ya es un embed de Google Maps, la usa en iframe.
 * Si no, devuelve `null` (mostrar enlace externo).
 */
export function mapsEmbedSrc(googleMapsUrl: string | null | undefined): string | null {
  if (!googleMapsUrl?.trim()) return null;
  const url = googleMapsUrl.trim();
  if (url.includes("/maps/embed")) return url;
  return null;
}
