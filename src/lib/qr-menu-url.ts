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
 * Origen público del sitio del tenant (institucional / home).
 * En local: `http://{slug}.localhost:{port}`; en prod: `https://{slug}.{root}`.
 */
export function buildTenantSiteUrl(tenantSlug: string): string {
  const slug = tenantSlug.trim().toLowerCase();
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const isLocal =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1";
    if (isLocal) {
      const portSuffix = port ? `:${port}` : "";
      return `${protocol}//${slug}.localhost${portSuffix}`;
    }
  }
  return `https://${slug}.${getPublicRootDomain()}`;
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

export type BuildPublicMenuUrlOptions = {
  tableNumber?: string | number | null;
  /** Token firmado del QR (?t=). Obligatorio para pedir en mesa. */
  tableToken?: string | null;
};

/**
 * URL del menú público.
 * - Sin mesa: `https://{slug}.{domain}/menu`
 * - Con mesa + token: `https://{slug}.{domain}/menu?m=4&t=...`
 */
export function buildPublicMenuUrl(
  tenantSlug: string,
  tableNumberOrOptions?: string | number | null | BuildPublicMenuUrlOptions,
  tableTokenArg?: string | null,
): string {
  const slug = tenantSlug.trim().toLowerCase();
  const domain = getPublicRootDomain();
  const base = `https://${slug}.${domain}/menu`;

  let tableNumber: string | number | null | undefined;
  let tableToken: string | null | undefined;

  if (
    tableNumberOrOptions != null &&
    typeof tableNumberOrOptions === "object" &&
    !Array.isArray(tableNumberOrOptions)
  ) {
    tableNumber = tableNumberOrOptions.tableNumber;
    tableToken = tableNumberOrOptions.tableToken;
  } else {
    tableNumber = tableNumberOrOptions as string | number | null | undefined;
    tableToken = tableTokenArg;
  }

  if (tableNumber == null || String(tableNumber).trim() === "") return base;
  const param = toQrTableParam(tableNumber);
  if (!param) return base;

  const params = new URLSearchParams();
  params.set("m", param);
  const token = tableToken?.trim();
  if (token) params.set("t", token);
  return `${base}?${params.toString()}`;
}

/** Path relativo del menú (mismo host del tenant). */
export function buildMenuPath(
  tableNumber?: string | null,
  tableToken?: string | null,
): string {
  if (!tableNumber?.trim()) return "/menu";
  const params = new URLSearchParams();
  params.set("m", tableNumber.trim());
  if (tableToken?.trim()) params.set("t", tableToken.trim());
  return `/menu?${params.toString()}`;
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
