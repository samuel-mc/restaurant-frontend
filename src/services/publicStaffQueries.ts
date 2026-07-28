/**
 * Directorio público de personal activo (login por selección + PIN).
 */

import type { PublicStaffMember } from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const PUBLIC_STAFF_PATH = "/api/v1/public/staff";

export type PublicStaffDirectory = {
  staff: PublicStaffMember[];
  /** true cuando la API falló (no confundir con lista vacía real). */
  loadFailed: boolean;
};

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

/**
 * Carga el directorio sin tumbar la página.
 * Distingue vacío real (ok) de fallo de red/API (`loadFailed`).
 */
export async function getPublicActiveStaffDirectory(
  tenantSlug: string,
): Promise<PublicStaffDirectory> {
  try {
    const staff = await getPublicActiveStaff(tenantSlug);
    return { staff: Array.isArray(staff) ? staff : [], loadFailed: false };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { staff: [], loadFailed: false };
    }
    console.error("No se pudo cargar el directorio de personal", error);
    return { staff: [], loadFailed: true };
  }
}

/** @deprecated Preferir `getPublicActiveStaffDirectory` para no confundir error con vacío. */
export async function getPublicActiveStaffOrEmpty(
  tenantSlug: string,
): Promise<PublicStaffMember[]> {
  const { staff } = await getPublicActiveStaffDirectory(tenantSlug);
  return staff;
}
