/**
 * Tipos del flujo de autenticación / onboarding del SaaS.
 */

/** Payload de registro de un nuevo restaurante (tenant + owner). */
export interface RegisterTenantDTO {
  restaurantName: string;
  /** Subdominio deseado (ej. "mario" → mario.tusass.com). */
  tenantSlug: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}

/** Respuesta 201 del backend tras crear el tenant. */
export interface RegisterTenantResponse {
  restaurantId: number;
  restaurantName: string;
  tenantSlug: string;
  ownerEmail: string;
  loginPath: string;
}
