/**
 * Consultas del piso / mesas (solo servidor).
 */

import "server-only";

import { resolveTenantSlug } from "@/lib/tenant";
import { getAdminAuthHeaders } from "@/lib/auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const TABLES_CONFIG_PATH = "/api/v1/admin/tables/config";

const DEFAULT_TABLE_COUNT = 12;
const MIN_TABLE_COUNT = 1;
const MAX_TABLE_COUNT = 99;

export interface TableFloorConfig {
  tableCount: number;
}

function resolveTableCount(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_TABLE_COUNT;
  const truncated = Math.trunc(n);
  if (truncated < MIN_TABLE_COUNT) return DEFAULT_TABLE_COUNT;
  if (truncated > MAX_TABLE_COUNT) return MAX_TABLE_COUNT;
  return truncated;
}

export async function getTableFloorConfig(
  tenantSlug: string,
): Promise<TableFloorConfig> {
  const slug = resolveTenantSlug(tenantSlug);
  const authHeaders = await getAdminAuthHeaders();

  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url: TABLES_CONFIG_PATH,
    });
  }

  const dto = await apiClient.get<{ tableCount?: number }>(TABLES_CONFIG_PATH, {
    headers: {
      ...authHeaders,
      [TENANT_HEADER]: slug,
    },
    cache: "no-store",
  });

  return { tableCount: resolveTableCount(dto?.tableCount) };
}
