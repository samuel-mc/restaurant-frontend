/**
 * Mutaciones de pedidos admin desde el cliente (vía BFF same-origin).
 */

import type { Order, OrderResponse, OrderStatus } from "@/types/api";
import { toOrder } from "@/lib/order-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

const BFF_STATUS_PATH = "/api/admin/orders";

/**
 * Avanza el estado de una comanda (BFF inyecta JWT HttpOnly + X-Tenant).
 */
export async function updateOrderStatus(
  orderUuid: string,
  status: OrderStatus,
  tenantSlug: string,
): Promise<Order> {
  const slug = resolveTenantSlug(tenantSlug);
  const response = await fetch(`${BFF_STATUS_PATH}/${orderUuid}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
    body: JSON.stringify({ status }),
  });

  const body = (await response.json().catch(() => null)) as
    | OrderResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? body.error
        : "No se pudo actualizar el estado del pedido.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url: `${BFF_STATUS_PATH}/${orderUuid}/status`,
      body,
    });
  }

  return toOrder(body as OrderResponse);
}
