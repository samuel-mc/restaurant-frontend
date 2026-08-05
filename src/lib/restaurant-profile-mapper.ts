/**
 * Normalización del perfil de restaurante (settings).
 */

import type {
  RestaurantProfile,
  RestaurantProfileResponse,
} from "@/types/api";

const DEFAULT_PRIMARY = "#171717";
const DEFAULT_SECONDARY = "#737373";
const DEFAULT_TABLE_COUNT = 12;
const MIN_TABLE_COUNT = 1;
const MAX_TABLE_COUNT = 99;

function resolveTableCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TABLE_COUNT;
  }
  const n = Math.trunc(value);
  if (n < MIN_TABLE_COUNT) return DEFAULT_TABLE_COUNT;
  if (n > MAX_TABLE_COUNT) return MAX_TABLE_COUNT;
  return n;
}

export function toRestaurantProfile(
  dto: RestaurantProfileResponse,
): RestaurantProfile {
  return {
    id: dto.id,
    name: dto.name,
    subdomain: dto.subdomain,
    logoUrl: dto.logoUrl ?? null,
    bannerUrl: dto.bannerUrl ?? null,
    faviconUrl: dto.faviconUrl ?? null,
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
    orderingEnabled: dto.orderingEnabled !== false,
    tableCount: resolveTableCount(dto.tableCount),
    websitePublished: Boolean(dto.websitePublished),
    plan: dto.plan === "PRO" ? "PRO" : "BASIC",
    paymentStatus:
      dto.paymentStatus === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "ACTIVE",
    updatedAt: dto.updatedAt,
  };
}
