/**
 * Normalización de pedidos (wire → dominio).
 */

import type {
  Order,
  OrderItemStatus,
  OrderPage,
  OrderPageResponse,
  OrderResponse,
} from "@/types/api";
import { formatCurrency } from "@/lib/format";

function resolveItemStatus(
  status: OrderItemStatus | undefined,
): OrderItemStatus {
  if (status === "PREPARING" || status === "DELIVERED" || status === "PENDING") {
    return status;
  }
  return "PENDING";
}

export function toOrder(dto: OrderResponse): Order {
  return {
    id: dto.id ?? null,
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
    updatedAt: dto.updatedAt ?? null,
    items: (dto.details ?? []).map((detail) => ({
      id: detail.id ?? null,
      productUuid: detail.productUuid ?? "",
      productName: detail.productName,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      subtotal: detail.subtotal,
      formattedSubtotal: formatCurrency(detail.subtotal),
      notes: detail.notes ?? null,
      batchNumber: detail.batchNumber ?? 1,
      status: resolveItemStatus(detail.status),
      modifiers: (detail.modifiers ?? []).map((mod) => ({
        modifierUuid: mod.modifierUuid ?? null,
        name: mod.name,
        priceDelta: mod.priceDelta ?? 0,
        formattedPriceDelta: formatCurrency(mod.priceDelta ?? 0),
      })),
    })),
  };
}

export function toOrderPage(dto: OrderPageResponse): OrderPage {
  return {
    content: (dto.content ?? []).map(toOrder),
    totalElements: dto.totalElements ?? 0,
    totalPages: dto.totalPages ?? 0,
    size: dto.size ?? 0,
    number: dto.number ?? 0,
    first: Boolean(dto.first),
    last: Boolean(dto.last),
    empty: Boolean(dto.empty),
  };
}

export function maxBatchNumber(order: Order): number {
  if (order.items.length === 0) return 0;
  return Math.max(...order.items.map((item) => item.batchNumber));
}
