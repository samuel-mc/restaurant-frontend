/**
 * Consultas SSR del módulo Equipo.
 */

import "server-only";

import type { StaffMemberResponse } from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { getAdminAuthHeaders } from "@/lib/auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

const TEAM_PATH = "/api/v1/admin/team";
const TENANT_HEADER = "X-Tenant";

export async function getTeamMembers(
  tenantSlug: string,
): Promise<StaffMemberResponse[]> {
  const slug = resolveTenantSlug(tenantSlug);
  const authHeaders = await getAdminAuthHeaders();

  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url: TEAM_PATH,
    });
  }

  return apiClient.get<StaffMemberResponse[]>(TEAM_PATH, {
    headers: { ...authHeaders, [TENANT_HEADER]: slug },
    cache: "no-store",
  });
}
