/**
 * Mutaciones del perfil/settings vía BFF (JWT HttpOnly + multipart).
 */

import type {
  RestaurantProfile,
  RestaurantProfileResponse,
} from "@/types/api";
import { toRestaurantProfile } from "@/lib/restaurant-profile-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

export interface RestaurantProfileFormPayload {
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  address: string;
  googleMapsUrl: string;
  whatsapp: string;
  businessHours: string;
  hasDelivery: boolean;
  hasPickup: boolean;
  hasReservations: boolean;
  logoFile: File | null;
  bannerFile: File | null;
}

function buildFormData(payload: RestaurantProfileFormPayload): FormData {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("description", payload.description);
  formData.append("primaryColor", payload.primaryColor);
  formData.append("secondaryColor", payload.secondaryColor);
  formData.append("address", payload.address);
  formData.append("googleMapsUrl", payload.googleMapsUrl);
  formData.append("whatsapp", payload.whatsapp);
  formData.append("businessHours", payload.businessHours);
  formData.append("hasDelivery", String(payload.hasDelivery));
  formData.append("hasPickup", String(payload.hasPickup));
  formData.append("hasReservations", String(payload.hasReservations));
  if (payload.logoFile) {
    formData.append("logo", payload.logoFile);
  }
  if (payload.bannerFile) {
    formData.append("banner", payload.bannerFile);
  }
  return formData;
}

export async function updateRestaurantProfile(
  payload: RestaurantProfileFormPayload,
  tenantSlug: string,
): Promise<RestaurantProfile> {
  const slug = resolveTenantSlug(tenantSlug);
  const formData = buildFormData(payload);

  const response = await fetch("/api/admin/restaurants/profile", {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "x-tenant-slug": slug,
      // No Content-Type: el boundary multipart lo pone el runtime.
    },
    credentials: "same-origin",
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as
    | RestaurantProfileResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudo guardar la configuración.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url: "/api/admin/restaurants/profile",
      body,
    });
  }

  return toRestaurantProfile(body as RestaurantProfileResponse);
}
