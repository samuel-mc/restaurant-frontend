/**
 * Consulta del perfil del restaurante (solo servidor).
 */

import "server-only";

import type { RestaurantProfile, RestaurantProfileResponse } from "@/types/api";
import { toRestaurantProfile } from "@/lib/restaurant-profile-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { getAdminAuthHeaders } from "@/lib/auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const PROFILE_PATH = "/api/v1/admin/restaurants/profile";

export async function getRestaurantProfile(
  tenantSlug: string,
): Promise<RestaurantProfile> {
  const slug = resolveTenantSlug(tenantSlug);
  const authHeaders = await getAdminAuthHeaders();

  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url: PROFILE_PATH,
    });
  }

  const dto = await apiClient.get<RestaurantProfileResponse>(PROFILE_PATH, {
    headers: {
      ...authHeaders,
      [TENANT_HEADER]: slug,
    },
    cache: "no-store",
  });

  return toRestaurantProfile(dto);
}
