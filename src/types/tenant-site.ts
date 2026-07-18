/**
 * Modelo del website institucional de un restaurante (uno por tenant).
 *
 * Cada sitio se crea bajo demanda (admin/settings o onboarding). No todos los
 * tenants comparten el mismo contenido: La Trattoria es un sitio exclusivo,
 * otro restaurante tendrá el suyo propio.
 */

/** Identificador de plantilla de website. Se ampliará conforme existan más diseños. */
export type SiteTemplateId = "la-trattoria";

/** Estado de publicación del website institucional. */
export type SitePublishStatus = "published" | "draft" | "not_created";

/** Configuración del website de un tenant. */
export interface TenantSiteConfig {
  /** Subdominio del restaurante (ej. "latrattoria"). */
  slug: string;
  /** Nombre comercial. */
  name: string;
  /** Subtítulo / categoría. */
  tagline: string;
  /** Plantilla exclusiva que renderiza este sitio. */
  templateId: SiteTemplateId;
  /** Si el sitio ya está publicado y visible al público. */
  status: SitePublishStatus;
}
