/**
 * Identidad pública del restaurante para plantillas de sitio / menú.
 */

export interface RestaurantBrand {
  name: string;
  tagline?: string;
  slug?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  description?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  whatsapp?: string | null;
  businessHours?: string | null;
  hasDelivery?: boolean;
  hasPickup?: boolean;
  hasReservations?: boolean;
}

export const DEFAULT_RESTAURANT_BRAND: RestaurantBrand = {
  name: "La Trattoria",
  tagline: "Ristorante Italiano",
  slug: "latrattoria",
  primaryColor: "#1A3D2B",
  secondaryColor: "#C9612A",
  hasDelivery: false,
  hasPickup: true,
  hasReservations: false,
};
