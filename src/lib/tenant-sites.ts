/**
 * Resolución del website institucional por tenant.
 *
 * Fuente de verdad: `RestaurantProfile.websitePublished` (backend).
 * La plantilla por defecto se usa hasta que exista multi-template.
 */

import type { RestaurantProfile } from "@/types/api";
import type { SiteTemplateId, TenantSiteConfig } from "@/types/tenant-site";

/** Única plantilla MVP; se ampliará cuando haya multi-template. */
export const DEFAULT_SITE_TEMPLATE_ID: SiteTemplateId = "la-trattoria";

/**
 * Construye la config del sitio si el perfil tiene el website publicado.
 * Devuelve `null` si aún no está publicado (flujo bajo demanda).
 */
export function resolveTenantSite(
  tenantSlug: string,
  profile: RestaurantProfile | null,
): TenantSiteConfig | null {
  if (!profile?.websitePublished) return null;

  const slug = (profile.subdomain || tenantSlug).trim().toLowerCase();
  if (!slug) return null;

  return {
    slug,
    name: profile.name.trim() || prettifyTenantSlug(slug),
    tagline: deriveTagline(profile),
    templateId: DEFAULT_SITE_TEMPLATE_ID,
    status: "published",
  };
}

function deriveTagline(profile: RestaurantProfile): string {
  const desc = profile.description?.trim();
  if (!desc) return "Restaurante";
  const firstLine = desc.split(/\n/)[0]?.trim() || desc;
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77)}…`;
}

/** Convierte el slug en un nombre legible para placeholders / SEO. */
export function prettifyTenantSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
