/**
 * Llamadas de mesa desde el menú QR (llamar mesero / pedir cuenta).
 * POST `/api/v1/orders/table-calls` con cabecera `X-Tenant`.
 */

import type { TableCallRequest, TableCallResponse } from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const TABLE_CALLS_PATH = "/api/v1/orders/table-calls";

function requireTenantSlug(tenantSlug?: string | null): string {
  try {
    return resolveTenantSlug(tenantSlug);
  } catch (error) {
    throw new ApiError({
      message:
        error instanceof Error
          ? error.message
          : "No se pudo identificar el restaurante.",
      status: 0,
      statusText: "Bad Request",
      url: TABLE_CALLS_PATH,
    });
  }
}

export async function createTableCall(
  tenantSlug: string,
  body: TableCallRequest,
): Promise<TableCallResponse> {
  const slug = requireTenantSlug(tenantSlug);
  return apiClient.post<TableCallResponse>(TABLE_CALLS_PATH, body, {
    headers: { [TENANT_HEADER]: slug },
  });
}

export function getTableCallErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "No pudimos avisar al personal. Intenta de nuevo.";
}
