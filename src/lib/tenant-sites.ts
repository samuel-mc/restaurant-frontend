/**
 * Resolución del website institucional por tenant.
 *
 * - `websitePublished` (backend) → el cliente activó / pagó el sitio.
 * - `hasTenantLanding` (registro front) → ya entregamos el diseño custom.
 */

import type { RestaurantProfile } from "@/types/api";
import type { TenantSiteConfig } from "@/types/tenant-site";
import { hasTenantLanding } from "@/lib/tenant-landings";

/**
 * Construye la config del sitio si el perfil tiene el website publicado.
 * Devuelve `null` si aún no está publicado.
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
    status: "published",
    hasCustomLanding: hasTenantLanding(slug),
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
