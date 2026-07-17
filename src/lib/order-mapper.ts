/**
 * Normalización de pedidos (wire → dominio).
 */

import type { Order, OrderResponse } from "@/types/api";
import { formatCurrency } from "@/lib/format";

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
