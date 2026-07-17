/**
 * Consultas admin de pedidos (solo servidor).
 */

import "server-only";

import type { Order, OrderResponse } from "@/types/api";
import { toOrder } from "@/lib/order-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { getAdminAuthHeaders } from "@/lib/auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const ADMIN_ORDERS_PATH = "/api/v1/admin/orders";

/**
 * Snapshot de comandas activas (PENDING / ACCEPTED / IN_KITCHEN).
 */
export async function getActiveOrders(tenantSlug: string): Promise<Order[]> {
  const slug = resolveTenantSlug(tenantSlug);
  const authHeaders = await getAdminAuthHeaders();

  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url: `${ADMIN_ORDERS_PATH}/active`,
    });
  }

  const catalog = await apiClient.get<OrderResponse[]>(
    `${ADMIN_ORDERS_PATH}/active`,
    {
      headers: {
        ...authHeaders,
        [TENANT_HEADER]: slug,
      },
      cache: "no-store",
    },
  );

  return catalog.map(toOrder);
}
