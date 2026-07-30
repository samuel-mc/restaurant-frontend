/**
 * Mutaciones / listado de pedidos admin desde el cliente (vía BFF same-origin).
 */

import type {
  AdminOrderListFilter,
  Order,
  OrderItemStatus,
  OrderPage,
  OrderPageResponse,
  OrderResponse,
  OrderStatus,
} from "@/types/api";
import { toOrder, toOrderPage } from "@/lib/order-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

const BFF_ORDERS_PATH = "/api/admin/orders";

export interface ClientListOrdersParams {
  tenantSlug: string;
  filter?: AdminOrderListFilter;
  page?: number;
  size?: number;
}

/** Listado paginado (cliente → BFF). */
export async function listOrders(
  params: ClientListOrdersParams,
): Promise<OrderPage> {
  const slug = resolveTenantSlug(params.tenantSlug);
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const filter = params.filter ?? "ALL";
  const query = new URLSearchParams({
    page: String(page),
    size: String(size),
    filter,
    sort: "updatedAt,desc",
  });
  const url = `${BFF_ORDERS_PATH}?${query.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | OrderPageResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudieron cargar los pedidos.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url,
      body,
    });
  }

  return toOrderPage(body as OrderPageResponse);
}

/**
 * Avanza el estado de una comanda (BFF inyecta JWT HttpOnly + X-Tenant).
 */
export async function updateOrderStatus(
  orderUuid: string,
  status: OrderStatus,
  tenantSlug: string,
): Promise<Order> {
  const slug = resolveTenantSlug(tenantSlug);
  const response = await fetch(`${BFF_ORDERS_PATH}/${orderUuid}/status`, {
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
      url: `${BFF_ORDERS_PATH}/${orderUuid}/status`,
      body,
    });
  }

  return toOrder(body as OrderResponse);
}

/** Marca el estado de un ítem individual (p. ej. entregado). */
export async function updateOrderItemStatus(
  orderUuid: string,
  detailId: number,
  status: OrderItemStatus,
  tenantSlug: string,
): Promise<Order> {
  const slug = resolveTenantSlug(tenantSlug);
  const url = `${BFF_ORDERS_PATH}/${orderUuid}/items/${detailId}/status`;
  const response = await fetch(url, {
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
        ? String(body.error)
        : "No se pudo actualizar el platillo.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url,
      body,
    });
  }

  return toOrder(body as OrderResponse);
}

/** Cierra/cobra la cuenta y libera la mesa (status CLOSED). */
export async function closeOrder(
  orderUuid: string,
  tenantSlug: string,
): Promise<Order> {
  const slug = resolveTenantSlug(tenantSlug);
  const url = `${BFF_ORDERS_PATH}/${orderUuid}/close`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
  });

  const body = (await response.json().catch(() => null)) as
    | OrderResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudo cerrar la cuenta.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url,
      body,
    });
  }

  return toOrder(body as OrderResponse);
}

export interface StaffOrderPayload {
  tableNumber: string;
  customerName?: string | null;
  activeOrderUuid?: string | null;
  details: Array<{
    productUuid: string;
    quantity: number;
    notes?: string | null;
    modifierUuids?: string[];
  }>;
}

/** Comanda manual del mesero (abre mesa o adición) → cocina. */
export async function createStaffOrder(
  payload: StaffOrderPayload,
  tenantSlug: string,
): Promise<Order> {
  const slug = resolveTenantSlug(tenantSlug);
  const response = await fetch(BFF_ORDERS_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as
    | OrderResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudo enviar la comanda.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url: BFF_ORDERS_PATH,
      body,
    });
  }

  return toOrder(body as OrderResponse);
}

export interface MergeTablesPayload {
  tenantSlug?: string;
  primaryTable: string;
  secondaryTables: string[];
}

/** Une mesas secundarias a la cuenta de la mesa principal. */
export async function mergeTables(
  payload: MergeTablesPayload,
  tenantSlug: string,
): Promise<Order> {
  const slug = resolveTenantSlug(tenantSlug);
  const url = "/api/admin/tables/merge";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
    body: JSON.stringify({
      tenantSlug: slug,
      primaryTable: payload.primaryTable,
      secondaryTables: payload.secondaryTables,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | OrderResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudieron unir las mesas.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url,
      body,
    });
  }

  return toOrder(body as OrderResponse);
}
