/**
 * Servicio de autenticación del panel admin.
 *
 * - `login`: POST a Spring Boot `/api/v1/auth/login` con cabecera `X-Tenant`.
 * - `setToken` / `clearToken`: cookie HttpOnly vía Route Handler same-origin
 *   (mitiga XSS; el token no es legible desde JavaScript).
 */

import type { LoginRequest, LoginResponse } from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";

/** Cabecera que el backend (`TenantFilter`) usa para aislar el restaurante. */
const TENANT_HEADER = "X-Tenant";

const LOGIN_PATH = "/api/v1/auth/login";
const SESSION_PATH = "/api/auth/session";

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Autentica al usuario contra el backend del tenant indicado.
 *
 * @returns JWT firmado por Spring Boot.
 */
export async function login(
  credentials: LoginCredentials,
  tenantSlug: string,
): Promise<string> {
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  if (!email || !password) {
    throw new ApiError({
      message: "Correo y contraseña son obligatorios.",
      status: 0,
      statusText: "Bad Request",
      url: LOGIN_PATH,
    });
  }

  let slug: string;
  try {
    slug = resolveTenantSlug(tenantSlug);
  } catch (error) {
    throw new ApiError({
      message:
        error instanceof Error
          ? error.message
          : "No se pudo identificar el restaurante.",
      status: 0,
      statusText: "Bad Request",
      url: LOGIN_PATH,
    });
  }

  const body: LoginRequest = { email, password };

  const response = await apiClient.post<LoginResponse>(LOGIN_PATH, body, {
    headers: { [TENANT_HEADER]: slug },
    cache: "no-store",
  });

  const token = response?.token?.trim();
  if (!token) {
    throw new ApiError({
      message: "El servidor no devolvió un token de acceso.",
      status: 0,
      statusText: "Invalid Response",
      url: LOGIN_PATH,
      body: response,
    });
  }

  return token;
}

/**
 * Persiste el JWT en una cookie HttpOnly (same-origin Route Handler).
 * Así el token viaja en peticiones posteriores a rutas protegidas de Next.js
 * sin exponerse a scripts de la página.
 */
export async function setToken(token: string): Promise<void> {
  const response = await fetch(SESSION_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new ApiError({
      message: "No se pudo guardar la sesión de forma segura.",
      status: response.status,
      statusText: response.statusText,
      url: SESSION_PATH,
    });
  }
}

/** Elimina la cookie de sesión admin. */
export async function clearToken(): Promise<void> {
  await fetch(SESSION_PATH, {
    method: "DELETE",
    credentials: "same-origin",
  });
}

/** Mensaje amigable ante fallos de login (credenciales / tenant / red). */
export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusText === "Configuration Error") {
      return error.message;
    }
    if (error.isNetworkError) {
      return "No pudimos conectar con el servidor. Verifica que el backend esté en http://localhost:8080 y que CORS permita tu subdominio (*.localhost).";
    }
    if (error.status === 401) {
      return "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
    }
    if (error.status === 404) {
      return "No encontramos este restaurante. Abre el panel desde el enlace correcto del local.";
    }
    if (error.status === 400) {
      return (
        error.message ||
        "No pudimos validar el acceso a este restaurante. Si el problema continúa, contacta al administrador."
      );
    }
    return (
      error.message ||
      "No pudimos iniciar sesión en este momento. Intenta de nuevo en unos segundos."
    );
  }
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado al iniciar sesión.";
}
