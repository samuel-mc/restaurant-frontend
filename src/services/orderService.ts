/**
 * Servicio de pedidos del comensal.
 *
 * Publica órdenes vía `POST /api/v1/orders` (fetch encapsulado en `apiClient`).
 *
 * Aislamiento multi-tenant hacia Spring Boot:
 * - Cabecera `X-Tenant` = slug del restaurante (lo que lee `TenantFilter`).
 * - NO confundir con `x-tenant-slug`, cabecera interna del proxy Next.js
 *   (`src/proxy.ts`) usada solo entre el edge y los Server Components.
 */

import type {
  CreateOrderDTO,
  Order,
  OrderRequest,
  OrderResponse,
} from "@/types/api";
import { formatCurrency } from "@/lib/format";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";

/**
 * Cabecera que el backend (`TenantFilter`) usa para identificar al restaurante.
 * Debe coincidir con la allowlist CORS del backend (`X-Tenant`).
 */
const TENANT_HEADER = "X-Tenant";

/** Endpoint público de creación / consulta de pedidos. */
const ORDERS_PATH = "/api/v1/orders";

/** Nombre por defecto cuando el comensal no lo indica (el backend exige `@NotBlank`). */
const DEFAULT_CUSTOMER_NAME = "Cliente";

/** Normaliza la respuesta wire al modelo de dominio `Order`. */
function toOrder(dto: OrderResponse): Order {
  return {
    uuid: dto.uuid,
    customerName: dto.customerName,
    customerPhone: dto.customerPhone ?? null,
    orderType: dto.orderType,
    tableNumber: dto.tableNumber ?? null,
    deliveryAddress: dto.deliveryAddress ?? null,
    status: dto.status,
    totalAmount: dto.totalAmount,
    formattedTotal: formatCurrency(dto.totalAmount),
    createdAt: dto.createdAt,
    items: (dto.details ?? []).map((detail) => ({
      productUuid: detail.productUuid,
      productName: detail.productName,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      subtotal: detail.subtotal,
      formattedSubtotal: formatCurrency(detail.subtotal),
      notes: detail.notes ?? null,
    })),
  };
}

/**
 * Mapea el DTO de aplicación al contrato `OrderRequest` del backend.
 * `productId` (app) → `productUuid` (wire). El total del cliente no se envía:
 * Spring lo recalcula con los precios vigentes.
 */
function toOrderRequest(orderData: CreateOrderDTO): OrderRequest {
  const customerName =
    orderData.customerName?.trim() || DEFAULT_CUSTOMER_NAME;
  const tableNumber = orderData.tableNumber?.trim() || null;

  return {
    customerName,
    customerPhone: orderData.customerPhone?.trim() || null,
    orderType: orderData.orderType ?? "IN_TABLE",
    tableNumber,
    deliveryAddress: orderData.deliveryAddress?.trim() || null,
    details: orderData.items.map((item) => ({
      productUuid: item.productId,
      quantity: item.quantity,
      notes: item.notes ?? null,
    })),
  };
}

function requireTenantSlug(tenantSlug?: string | null, url = ORDERS_PATH): string {
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
      url,
    });
  }
}

/**
 * Crea un pedido en el restaurante del tenant indicado.
 *
 * @param orderData Datos tipados del carrito (`CreateOrderDTO`).
 * @param tenantSlug Subdominio del restaurante (ruta/`params`). Si se omite,
 *                   se infiere del hostname (subdominio actual).
 * @returns Pedido normalizado con el `uuid` público para tracking.
 * @throws {ApiError} Ante validación, tenant inválido o fallo de red/backend.
 */
export async function createOrder(
  orderData: CreateOrderDTO,
  tenantSlug?: string | null,
): Promise<Order> {
  if (!orderData.items.length) {
    throw new ApiError({
      message: "Tu pedido está vacío. Agrega al menos un platillo.",
      status: 0,
      statusText: "Bad Request",
      url: ORDERS_PATH,
    });
  }

  const slug = requireTenantSlug(tenantSlug);
  const body = toOrderRequest(orderData);

  const response = await apiClient.post<OrderResponse>(ORDERS_PATH, body, {
    headers: { [TENANT_HEADER]: slug },
    cache: "no-store",
  });

  if (!response?.uuid) {
    throw new ApiError({
      message: "El servidor no devolvió el identificador del pedido.",
      status: 0,
      statusText: "Invalid Response",
      url: ORDERS_PATH,
      body: response,
    });
  }

  return toOrder(response);
}

/**
 * Obtiene un pedido público por UUID para la pantalla de tracking.
 */
export async function getOrderByUuid(
  orderUuid: string,
  tenantSlug?: string | null,
): Promise<Order> {
  const uuid = orderUuid.trim();
  if (!uuid) {
    throw new ApiError({
      message: "Se requiere el identificador del pedido.",
      status: 0,
      statusText: "Bad Request",
      url: ORDERS_PATH,
    });
  }

  const slug = requireTenantSlug(tenantSlug, `${ORDERS_PATH}/${uuid}`);

  const response = await apiClient.get<OrderResponse>(`${ORDERS_PATH}/${uuid}`, {
    headers: { [TENANT_HEADER]: slug },
    cache: "no-store",
  });

  return toOrder(response);
}

/** Mensaje amigable a partir de un fallo al crear el pedido. */
export function getCreateOrderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      return "No pudimos conectar con el restaurante. Revisa tu conexión e intenta de nuevo.";
    }
    if (error.status === 404) {
      return "No encontramos este restaurante. Verifica el enlace o el código QR.";
    }
    if (error.status === 400 || error.status === 422) {
      return (
        error.message ||
        "Algunos platillos ya no están disponibles. Revisa tu pedido e intenta otra vez."
      );
    }
    return (
      error.message ||
      "No pudimos confirmar tu pedido en este momento. Intenta de nuevo en unos segundos."
    );
  }
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado al confirmar tu pedido.";
}
