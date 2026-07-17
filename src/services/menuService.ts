/**
 * Servicio de menú del comensal.
 *
 * Consume el catálogo público del backend y lo normaliza a modelos de dominio
 * (`Product`) con el precio ya formateado. El restaurante (tenant) se resuelve
 * enviando su subdominio en la cabecera `X-Tenant`, tal como espera el
 * `TenantFilter` del backend.
 */

import type { Product, ProductResponse } from "@/types/api";
import { formatCurrency } from "@/lib/format";
import { apiClient, ApiError } from "@/services/apiClient";

/** Cabecera que el backend (`TenantFilter`) usa para identificar al restaurante. */
const TENANT_HEADER = "X-Tenant";

/** Endpoint público del catálogo de menú. */
const MENU_CATALOG_PATH = "/api/v1/menu/catalog";

/** Normaliza un `ProductResponse` crudo al modelo de dominio `Product`. */
function toProduct(dto: ProductResponse): Product {
  return {
    uuid: dto.uuid,
    name: dto.name,
    description: dto.description ?? null,
    price: dto.price,
    formattedPrice: formatCurrency(dto.price),
    imageUrl: dto.imageUrl ?? null,
    isAvailable: dto.isAvailable,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    createdAt: dto.createdAt,
  };
}

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
    // El menú cambia con poca frecuencia: cacheamos y etiquetamos por tenant
    // para poder revalidar de forma selectiva desde la gestión de menú.
    next: { revalidate: 60, tags: [`menu:${slug}`] },
  });

  return catalog.map(toProduct);
}
