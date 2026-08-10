/**
 * Llamadas de mesa desde el menú QR (llamar mesero / pedir cuenta).
 * POST `/api/v1/orders/table-calls` con cabecera `X-Tenant`.
 */

import type { TableCallRequest, TableCallResponse } from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { tableCallRequestSchema } from "@/lib/validation/schemas";
import { assertValid } from "@/lib/validation/parse";
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
  const validated = assertValid(tableCallRequestSchema, body, TABLE_CALLS_PATH);
  return apiClient.post<TableCallResponse>(TABLE_CALLS_PATH, validated, {
    headers: { [TENANT_HEADER]: slug },
  });
}

export function getTableCallErrorMessage(error: unknown): string {
  const fallback = "No pudimos avisar al personal. Intenta de nuevo.";
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      return "No pudimos conectar. Revisa tu conexión e intenta de nuevo.";
    }
    if (error.status === 429) {
      return "Demasiados avisos seguidos. Espera un momento e intenta de nuevo.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Este código QR ya no es válido. Pide al mesero el QR actualizado de tu mesa.";
    }
    if (error.status === 404) {
      return "No encontramos esta mesa. Escanea de nuevo el QR o pide ayuda al personal.";
    }
    if (error.status >= 500) {
      return "El restaurante no pudo recibir el aviso ahora. Intenta de nuevo en unos segundos.";
    }
    const msg = error.message.trim();
    if (!msg || /^error$/i.test(msg) || /^request failed$/i.test(msg)) {
      return fallback;
    }
    return msg;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}
