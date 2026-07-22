/**
 * Modelo del website institucional de un restaurante (uno por tenant).
 *
 * La publicación la controla el backend (`websitePublished` en el perfil).
 * El front resuelve la config con `resolveTenantSite`.
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
