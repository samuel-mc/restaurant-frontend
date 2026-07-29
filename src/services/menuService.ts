/**
 * Servicio de menú del comensal.
 *
 * Consume el catálogo público del backend y lo normaliza a modelos de dominio
 * (`Product`) con el precio ya formateado. El restaurante (tenant) se resuelve
 * enviando su subdominio en la cabecera `X-Tenant`, tal como espera el
 * `TenantFilter` del backend.
 */

import type { Product, ProductResponse } from "@/types/api";
import { toProduct } from "@/lib/product-mapper";
import { apiClient, ApiError } from "@/services/apiClient";

/** Cabecera que el backend (`TenantFilter`) usa para identificar al restaurante. */
const TENANT_HEADER = "X-Tenant";

/** Endpoint público del catálogo de menú. */
const MENU_CATALOG_PATH = "/api/v1/menu/catalog";

/**
 * Obtiene el menú público de un restaurante por su identificador de tenant.
 *
 * @param tenantSlug Subdominio del restaurante (ej. "mario"). Coincide con el
 *                   valor que resuelve el middleware desde el subdominio actual.
 * @returns Lista de productos disponibles, normalizados y con precio formateado.
 * @throws {ApiError} Si el tenant es inválido, no existe (404) o falla la red.
 */
export async function getMenuByTenant(tenantSlug: string): Promise<Product[]> {
  const slug = tenantSlug.trim();
  if (!slug) {
    throw new ApiError({
      message: "Se requiere un identificador de restaurante (tenantSlug) válido.",
      status: 0,
      statusText: "Bad Request",
      url: MENU_CATALOG_PATH,
    });
  }

  const catalog = await apiClient.get<ProductResponse[]>(MENU_CATALOG_PATH, {
    headers: { [TENANT_HEADER]: slug },
    // Sin caché: un tenant suspendido (isActive=false) debe dejar de servir
    // catálogo de inmediato; el perfil público ya usa no-store.
    cache: "no-store",
  });

  return catalog.map(toProduct);
}
