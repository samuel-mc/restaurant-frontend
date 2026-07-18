/**
 * Normalización de productos desde el wire (Jackson) al dominio.
 */

import type { Product, ProductResponse } from "@/types/api";
import { formatCurrency } from "@/lib/format";

/**
 * Jackson emite `available` para el campo Java `boolean isAvailable`.
 * Aceptamos ambos por si el contrato cambia.
 */
export function resolveProductAvailability(
  dto: ProductResponse | (Partial<ProductResponse> & { isAvailable?: boolean }),
): boolean {
  if (typeof dto.available === "boolean") return dto.available;
  if (
    dto &&
    typeof dto === "object" &&
    "isAvailable" in dto &&
    typeof (dto as { isAvailable?: unknown }).isAvailable === "boolean"
  ) {
    return Boolean((dto as { isAvailable: boolean }).isAvailable);
  }
  return false;
}

export function toProduct(dto: ProductResponse): Product {
  return {
    uuid: dto.uuid,
    name: dto.name,
    description: dto.description ?? null,
    price: dto.price,
    formattedPrice: formatCurrency(dto.price),
    imageUrl: dto.imageUrl ?? null,
    isAvailable: resolveProductAvailability(dto),
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    createdAt: dto.createdAt,
  };
}
