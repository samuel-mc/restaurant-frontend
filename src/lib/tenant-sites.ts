/**
 * Registro local de websites institucionales por tenant.
 *
 * Fuente de verdad temporal (hasta que el backend/settings exponga el sitio).
 * - Solo los tenants con entrada aquí tienen website propio.
 * - "La Trattoria" es exclusiva del slug `la-trattoria`.
 * - Un restaurante nuevo no hereda ese contenido: su sitio se crea bajo demanda.
 */

import type { TenantSiteConfig } from "@/types/tenant-site";

/**
 * Sitios publicados conocidos.
 * Agregar aquí (o vía API más adelante) cuando se cree un website bajo demanda.
 */
const TENANT_SITES: Readonly<Record<string, TenantSiteConfig>> = {
  "la-trattoria": {
    slug: "la-trattoria",
    name: "La Trattoria",
    tagline: "Ristorante Italiano",
    templateId: "la-trattoria",
    status: "published",
  },
};

/**
 * Resuelve el website institucional de un tenant.
 * Devuelve `null` si el sitio aún no fue creado (flujo bajo demanda).
 */
export function getTenantSite(slug: string): TenantSiteConfig | null {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const site = TENANT_SITES[normalized];
  if (!site || site.status !== "published") return null;
  return site;
}

/** Convierte el slug en un nombre legible para placeholders / SEO. */
export function prettifyTenantSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
