/**
 * Modelo del website institucional de un restaurante (uno por tenant).
 *
 * Estrategia producto: landing **custom por cliente** (fee de setup),
 * no multi-template masivo. Cada Pro se registra en `tenant-landings`.
 *
 * Publicación: `websitePublished` en el perfil.
 * Entrega: componente React registrado para ese subdominio.
 */

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
  /** Si el sitio ya está publicado y visible al público. */
  status: SitePublishStatus;
  /**
   * Si existe landing custom registrada en código para este slug.
   * Sin ella, el visitante ve “sitio en preparación”.
   */
  hasCustomLanding: boolean;
}
