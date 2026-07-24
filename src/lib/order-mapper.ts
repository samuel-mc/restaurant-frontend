/**
 * Normalización de pedidos (wire → dominio).
 */

import type { Order, OrderItemStatus, OrderResponse } from "@/types/api";
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
      id: detail.id ?? null,
      productUuid: detail.productUuid,
      productName: detail.productName,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      subtotal: detail.subtotal,
      formattedSubtotal: formatCurrency(detail.subtotal),
      notes: detail.notes ?? null,
      batchNumber: detail.batchNumber ?? 1,
      status: resolveItemStatus(detail.status),
    })),
  };
}

export function maxBatchNumber(order: Order): number {
  if (order.items.length === 0) return 0;
  return Math.max(...order.items.map((item) => item.batchNumber));
}
