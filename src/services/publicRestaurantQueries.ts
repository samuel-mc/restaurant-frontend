/**
 * Consulta pública del perfil de marca del restaurante (Server Components).
 */

import type { RestaurantProfile, RestaurantProfileResponse } from "@/types/api";
import { toRestaurantProfile } from "@/lib/restaurant-profile-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const PUBLIC_PROFILE_PATH = "/api/v1/restaurants/profile";

/**
 * Perfil público del tenant (identidad + módulos activos).
 * No requiere JWT; solo `X-Tenant`.
 */
export async function getPublicRestaurantProfile(
  tenantSlug: string,
): Promise<RestaurantProfile> {
  const slug = resolveTenantSlug(tenantSlug);

  const dto = await apiClient.get<RestaurantProfileResponse>(PUBLIC_PROFILE_PATH, {
    headers: { [TENANT_HEADER]: slug },
    cache: "no-store",
  });

  return toRestaurantProfile(dto);
}

/**
 * Variante tolerante: si el backend falla, devuelve `null`
 * (la UI cae a defaults / config estática).
 */
export async function getPublicRestaurantProfileOrNull(
  tenantSlug: string,
): Promise<RestaurantProfile | null> {
  try {
    return await getPublicRestaurantProfile(tenantSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    console.error("No se pudo cargar el perfil público del restaurante", error);
    return null;
  }
}
