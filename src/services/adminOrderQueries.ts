/**
 * Consultas admin de pedidos (solo servidor).
 */

import "server-only";

import type {
  AdminOrderListFilter,
  Order,
  OrderPage,
  OrderPageResponse,
  OrderResponse,
} from "@/types/api";
import { toOrder, toOrderPage } from "@/lib/order-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { getAdminAuthHeaders } from "@/lib/auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const ADMIN_ORDERS_PATH = "/api/v1/admin/orders";

/**
 * Snapshot de comandas activas (PENDING / ACCEPTED / IN_KITCHEN / DELIVERED).
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

export interface ListOrdersParams {
  tenantSlug: string;
  filter?: AdminOrderListFilter;
  page?: number;
  size?: number;
}

/** Listado paginado de pedidos/cuentas. */
export async function listOrders(params: ListOrdersParams): Promise<OrderPage> {
  const slug = resolveTenantSlug(params.tenantSlug);
  const authHeaders = await getAdminAuthHeaders();
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const filter = params.filter ?? "ALL";

  const query = new URLSearchParams({
    page: String(page),
    size: String(size),
    filter,
    sort: "updatedAt,desc",
  });

  const url = `${ADMIN_ORDERS_PATH}?${query.toString()}`;

  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url,
    });
  }

  const payload = await apiClient.get<OrderPageResponse>(url, {
    headers: {
      ...authHeaders,
      [TENANT_HEADER]: slug,
    },
    cache: "no-store",
  });

  return toOrderPage(payload);
}
