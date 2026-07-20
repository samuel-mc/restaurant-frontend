import type { RestaurantBrand } from "@/types/restaurant-brand";
import type { TenantSiteConfig } from "@/types/tenant-site";
import type { RestaurantProfile } from "@/types/api";
import { DEFAULT_RESTAURANT_BRAND } from "@/types/restaurant-brand";

export function buildLandingBrand(
  site: TenantSiteConfig,
  profile: RestaurantProfile | null,
): RestaurantBrand {
  return {
    name: profile?.name?.trim() || site.name,
    tagline: site.tagline,
    slug: site.slug,
    logoUrl: profile?.logoUrl ?? null,
    bannerUrl: profile?.bannerUrl ?? null,
    primaryColor: profile?.primaryColor || DEFAULT_RESTAURANT_BRAND.primaryColor,
    secondaryColor:
      profile?.secondaryColor || DEFAULT_RESTAURANT_BRAND.secondaryColor,
    description: profile?.description ?? null,
    address: profile?.address ?? null,
    googleMapsUrl: profile?.googleMapsUrl ?? null,
    whatsapp: profile?.whatsapp ?? null,
    businessHours: profile?.businessHours ?? null,
    hasDelivery: profile?.hasDelivery ?? false,
    hasPickup: profile?.hasPickup ?? true,
    hasReservations: profile?.hasReservations ?? false,
  };
}
