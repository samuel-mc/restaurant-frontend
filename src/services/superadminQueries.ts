/**
 * Queries SuperAdmin (solo servidor).
 */

import "server-only";

import type {
  SuperAdminCoupon,
  SuperAdminMetrics,
  SuperAdminMetricsApi,
  SuperAdminTenant,
} from "@/types/superadmin";
import { enrichSuperAdminMetrics } from "@/lib/superadmin-attention";
import { getSuperAdminAuthHeaders } from "@/lib/superadmin-auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

export async function getSuperAdminMetricsServer(): Promise<SuperAdminMetricsApi> {
  const auth = await getSuperAdminAuthHeaders();
  if (!("Authorization" in auth)) {
    throw new ApiError({
      message: "Sesión no encontrada.",
      status: 401,
      statusText: "Unauthorized",
      url: "/api/v1/superadmin/metrics",
    });
  }
  return apiClient.get<SuperAdminMetricsApi>("/api/v1/superadmin/metrics", {
    headers: auth,
    cache: "no-store",
  });
}

export async function getSuperAdminTenantsServer(): Promise<SuperAdminTenant[]> {
  const auth = await getSuperAdminAuthHeaders();
  if (!("Authorization" in auth)) {
    throw new ApiError({
      message: "Sesión no encontrada.",
      status: 401,
      statusText: "Unauthorized",
      url: "/api/v1/superadmin/tenants",
    });
  }
  return apiClient.get<SuperAdminTenant[]>("/api/v1/superadmin/tenants", {
    headers: auth,
    cache: "no-store",
  });
}

export async function getSuperAdminCouponsServer(): Promise<SuperAdminCoupon[]> {
  const auth = await getSuperAdminAuthHeaders();
  if (!("Authorization" in auth)) {
    throw new ApiError({
      message: "Sesión no encontrada.",
      status: 401,
      statusText: "Unauthorized",
      url: "/api/v1/superadmin/coupons",
    });
  }
  return apiClient.get<SuperAdminCoupon[]>("/api/v1/superadmin/coupons", {
    headers: auth,
    cache: "no-store",
  });
}

/** Panel: métricas + atención (API o enriquecido con listas). */
export async function getSuperAdminPanelMetricsServer(): Promise<SuperAdminMetrics> {
  const [api, tenants, coupons] = await Promise.all([
    getSuperAdminMetricsServer(),
    getSuperAdminTenantsServer(),
    getSuperAdminCouponsServer(),
  ]);
  return enrichSuperAdminMetrics(api, tenants, coupons);
}
