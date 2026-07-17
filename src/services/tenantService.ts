/**
 * Servicio de onboarding de restaurantes (dominio principal del SaaS).
 *
 * No envía `X-Tenant`: el endpoint es global y crea el tenant + OWNER.
 */

import type {
  RegisterTenantDTO,
  RegisterTenantResponse,
} from "@/types/auth";
import { apiClient, ApiError } from "@/services/apiClient";

const REGISTER_PATH = "/api/v1/tenants/register";

/**
 * Registra un restaurante y su usuario administrador inicial.
 *
 * @throws {ApiError} 400 si el slug/email ya existen o la validación falla.
 */
export async function registerRestaurant(
  data: RegisterTenantDTO,
): Promise<RegisterTenantResponse> {
  const payload: RegisterTenantDTO = {
    restaurantName: data.restaurantName.trim(),
    tenantSlug: data.tenantSlug.trim().toLowerCase(),
    ownerEmail: data.ownerEmail.trim().toLowerCase(),
    ownerName: data.ownerName.trim(),
    ownerPassword: data.ownerPassword,
  };

  return apiClient.post<RegisterTenantResponse>(REGISTER_PATH, payload, {
    cache: "no-store",
  });
}

/** Mensaje amigable ante fallos de registro. */
export function getRegisterErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusText === "Configuration Error") {
      return error.message;
    }
    if (error.isNetworkError) {
      return "No pudimos conectar con el servidor. ¿Está el backend en http://localhost:8080 y NEXT_PUBLIC_API_URL configurada?";
    }
    if (error.status === 400 || error.status === 409) {
      return (
        error.message ||
        "Ese subdominio o correo ya está en uso. Prueba con otros datos."
      );
    }
    return (
      error.message ||
      "No pudimos crear tu restaurante en este momento. Intenta de nuevo en unos segundos."
    );
  }
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado al registrar el restaurante.";
}
