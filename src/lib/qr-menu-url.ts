/**
 * URLs públicas del menú digital para códigos QR de mesa.
 */

const DEFAULT_ROOT_DOMAIN = "platolisto.com";

/** Dominio raíz de subdominios (ej. platolisto.com). */
export function getPublicRootDomain(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  return fromEnv || DEFAULT_ROOT_DOMAIN;
}

/**
 * Extrae solo dígitos para `?m=` (ej. "Mesa 4" / 4 → "4").
 * Máx. 10 caracteres (límite de `normalizeTableParam` en el menú).
 */
export function toQrTableParam(tableNumber: string | number): string {
  return String(tableNumber).replace(/\D/g, "").slice(0, 10);
}

/** Etiqueta visible en la tarjeta (ej. "Mesa 4"). */
export function tableDisplayLabel(tableNumber: string | number): string {
  const n = toQrTableParam(tableNumber);
  if (!n) return "Pide desde tu lugar";
  return `Mesa ${n}`;
}

/**
 * URL del menú público.
 * - Sin mesa: `https://{slug}.{domain}/menu`
 * - Con mesa: `https://{slug}.{domain}/menu?m=4`
 */
export function buildPublicMenuUrl(
  tenantSlug: string,
  tableNumber?: string | number | null,
): string {
  const slug = tenantSlug.trim().toLowerCase();
  const domain = getPublicRootDomain();
  const base = `https://${slug}.${domain}/menu`;
  if (tableNumber == null || String(tableNumber).trim() === "") return base;
  const param = toQrTableParam(tableNumber);
  if (!param) return base;
  return `${base}?m=${encodeURIComponent(param)}`;
}

/** Nombre de archivo PNG seguro. */
export function qrDownloadFilename(
  tenantSlug: string,
  tableNumber: string | number | null,
): string {
  const slug = tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/gi, "");
  if (tableNumber == null || String(tableNumber).trim() === "") {
    return `qr_menu_general_${slug}.png`;
  }
  const n = toQrTableParam(tableNumber);
  return `qr_mesa_${n || "x"}_${slug}.png`;
}
