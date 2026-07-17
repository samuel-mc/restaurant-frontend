/**
 * Resolución del tenant (subdominio del restaurante) en cliente y servidor.
 *
 * El proxy (`src/proxy.ts`) reescribe la URL pública (`/menu`) hacia
 * `/(public)/[tenant]/menu`, pero las llamadas al backend Spring Boot
 * requieren la cabecera `X-Tenant` con el slug del restaurante.
 */

const RESERVED_SUBDOMAINS = new Set(["www", "app"]);

/**
 * Extrae el slug del tenant a partir de un hostname.
 * Ej.: `mario.localhost` → `mario`, `mario.tusass.com` → `mario`.
 */
export function extractTenantFromHost(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null;
  }

  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase();
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -(rootDomain.length + 1));
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null;
  }

  return null;
}

/**
 * Resuelve el tenant slug con esta prioridad:
 * 1. Valor explícito (props / params de la ruta)
 * 2. Hostname del navegador (subdominio)
 *
 * @throws {Error} Si no se puede determinar el restaurante.
 */
export function resolveTenantSlug(explicit?: string | null): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;

  if (typeof window !== "undefined") {
    const fromHost = extractTenantFromHost(window.location.hostname);
    if (fromHost) return fromHost;
  }

  throw new Error(
    "No se pudo identificar el restaurante. Abre el menú desde el enlace o código QR del local.",
  );
}
