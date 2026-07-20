/**
 * Normalización del perfil de restaurante (settings).
 */

import type {
  RestaurantProfile,
  RestaurantProfileResponse,
} from "@/types/api";

const DEFAULT_PRIMARY = "#171717";
const DEFAULT_SECONDARY = "#737373";

export function toRestaurantProfile(
  dto: RestaurantProfileResponse,
): RestaurantProfile {
  return {
    id: dto.id,
    name: dto.name,
    subdomain: dto.subdomain,
    logoUrl: dto.logoUrl ?? null,
    bannerUrl: dto.bannerUrl ?? null,
    primaryColor: dto.primaryColor?.trim() || DEFAULT_PRIMARY,
    secondaryColor: dto.secondaryColor?.trim() || DEFAULT_SECONDARY,
    description: dto.description ?? null,
    address: dto.address ?? null,
    googleMapsUrl: dto.googleMapsUrl ?? null,
    whatsapp: dto.whatsapp ?? null,
    businessHours: dto.businessHours ?? null,
    hasDelivery: Boolean(dto.hasDelivery),
    hasPickup: Boolean(dto.hasPickup),
    hasReservations: Boolean(dto.hasReservations),
    updatedAt: dto.updatedAt,
  };
}
