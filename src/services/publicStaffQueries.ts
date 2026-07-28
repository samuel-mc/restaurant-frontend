/**
 * Directorio público de personal activo (login por selección + PIN).
 */

import type { PublicStaffMember } from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const PUBLIC_STAFF_PATH = "/api/v1/public/staff";

export async function getPublicActiveStaff(
  tenantSlug: string,
): Promise<PublicStaffMember[]> {
  const slug = resolveTenantSlug(tenantSlug);
  const query = new URLSearchParams({ tenantSlug: slug });

  return apiClient.get<PublicStaffMember[]>(
    `${PUBLIC_STAFF_PATH}?${query.toString()}`,
    {
      headers: { [TENANT_HEADER]: slug },
      cache: "no-store",
    },
  );
}

export async function getPublicActiveStaffOrEmpty(
  tenantSlug: string,
): Promise<PublicStaffMember[]> {
  try {
    return await getPublicActiveStaff(tenantSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    console.error("No se pudo cargar el directorio de personal", error);
    return [];
  }
}
