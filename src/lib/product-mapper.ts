/**
 * Normalización de productos desde el wire (Jackson) al dominio.
 */

import type {
  Product,
  ProductModifierGroup,
  ProductResponse,
} from "@/types/api";
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

function mapModifierGroups(dto: ProductResponse): ProductModifierGroup[] {
  const groups = dto.modifierGroups ?? [];
  return groups.map((group) => ({
    uuid: group.uuid,
    name: group.name,
    minSelect: group.minSelect ?? 0,
    maxSelect: group.maxSelect ?? 1,
    displayOrder: group.displayOrder ?? 0,
    options: (group.options ?? []).map((opt) => ({
      uuid: opt.uuid,
      name: opt.name,
      priceDelta: opt.priceDelta ?? 0,
      formattedPriceDelta: formatCurrency(opt.priceDelta ?? 0),
      available: opt.available !== false,
      displayOrder: opt.displayOrder ?? 0,
    })),
  }));
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
    modifierGroups: mapModifierGroups(dto),
  };
}
