/**
 * Mutaciones del perfil/settings vía BFF (JWT HttpOnly + multipart).
 *
 * En Vercel el body de una Serverless Function ~4.5MB. Por eso, si hay varias
 * imágenes (logo/banner/favicon), se suben en peticiones separadas.
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
  orderingEnabled: boolean;
  tableCount: number;
  websitePublished: boolean;
  logoFile: File | null;
  bannerFile: File | null;
  faviconFile: File | null;
}

type BrandImageKey = "logoFile" | "bannerFile" | "faviconFile";

const BRAND_IMAGE_KEYS: BrandImageKey[] = [
  "logoFile",
  "bannerFile",
  "faviconFile",
];

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
  formData.append("orderingEnabled", String(payload.orderingEnabled));
  formData.append("tableCount", String(payload.tableCount));
  formData.append("websitePublished", String(payload.websitePublished));
  if (payload.logoFile) {
    formData.append("logo", payload.logoFile);
  }
  if (payload.bannerFile) {
    formData.append("banner", payload.bannerFile);
  }
  if (payload.faviconFile) {
    formData.append("favicon", payload.faviconFile);
  }
  return formData;
}

function payloadWithSingleImage(
  payload: RestaurantProfileFormPayload,
  imageKey: BrandImageKey | null,
): RestaurantProfileFormPayload {
  return {
    ...payload,
    logoFile: imageKey === "logoFile" ? payload.logoFile : null,
    bannerFile: imageKey === "bannerFile" ? payload.bannerFile : null,
    faviconFile: imageKey === "faviconFile" ? payload.faviconFile : null,
  };
}

function errorMessageForStatus(
  status: number,
  fallbackFromBody: string | null,
): string {
  if (status === 413) {
    return (
      "La imagen es demasiado pesada para subirla de una vez. " +
      "Usa archivos de menos de 4 MB (o súbelas de una en una)."
    );
  }
  return fallbackFromBody ?? "No se pudo guardar la configuración.";
}

async function putProfileOnce(
  payload: RestaurantProfileFormPayload,
  slug: string,
): Promise<RestaurantProfile> {
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
    const fromBody =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : null;
    throw new ApiError({
      message: errorMessageForStatus(response.status, fromBody),
      status: response.status,
      statusText: response.statusText,
      url: "/api/admin/restaurants/profile",
      body,
    });
  }

  return toRestaurantProfile(body as RestaurantProfileResponse);
}

export async function updateRestaurantProfile(
  payload: RestaurantProfileFormPayload,
  tenantSlug: string,
): Promise<RestaurantProfile> {
  const slug = resolveTenantSlug(tenantSlug);
  const pendingImages = BRAND_IMAGE_KEYS.filter((key) => payload[key] != null);

  // Sin imágenes o una sola: un request basta.
  if (pendingImages.length <= 1) {
    return putProfileOnce(payload, slug);
  }

  // Varias imágenes: una petición por archivo (límite de body en Vercel ~4.5MB).
  let updated: RestaurantProfile | null = null;
  for (const imageKey of pendingImages) {
    updated = await putProfileOnce(payloadWithSingleImage(payload, imageKey), slug);
  }
  return updated!;
}
