/**
 * Cliente SuperAdmin (login + mutaciones vía BFF).
 */

import type {
  ImpersonateResult,
  SuperAdminCoupon,
  SuperAdminCouponCreateInput,
  SuperAdminCouponUpdateInput,
  SuperAdminMetricsApi,
  SuperAdminPaymentStatus,
  SuperAdminPlan,
  SuperAdminTenant,
} from "@/types/superadmin";
import { apiClient, ApiError } from "@/services/apiClient";

const LOGIN_PATH = "/api/v1/superadmin/auth/login";
const SESSION_PATH = "/api/superadmin/auth/session";

export async function loginSuperAdmin(
  email: string,
  password: string,
): Promise<string> {
  const response = await apiClient.post<{ token: string }>(
    LOGIN_PATH,
    {
      email: email.trim().toLowerCase(),
      password,
    },
    { cache: "no-store" },
  );
  const token = response?.token?.trim();
  if (!token) {
    throw new ApiError({
      message: "El servidor no devolvió un token.",
      status: 0,
      statusText: "Invalid Response",
      url: LOGIN_PATH,
      body: response,
    });
  }
  return token;
}

export async function setSuperAdminToken(token: string): Promise<void> {
  const response = await fetch(SESSION_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new ApiError({
      message: "No se pudo guardar la sesión SuperAdmin.",
      status: response.status,
      statusText: response.statusText,
      url: SESSION_PATH,
    });
  }
}

export async function clearSuperAdminToken(): Promise<void> {
  await fetch(SESSION_PATH, {
    method: "DELETE",
    credentials: "same-origin",
  });
}

async function bffJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: string; message?: string }
    | null;
  if (!response.ok) {
    const fromBody =
      body && typeof body === "object"
        ? ("error" in body && body.error
            ? String(body.error)
            : "message" in body && body.message
              ? String(body.message)
              : null)
        : null;
    throw new ApiError({
      message: fromBody ?? fallbackSuperAdminError(response.status),
      status: response.status,
      statusText: response.statusText,
      url,
      body,
    });
  }
  return body as T;
}

function fallbackSuperAdminError(status: number): string {
  if (status === 401 || status === 403) {
    return "Sesión SuperAdmin no válida o expirada. Vuelve a iniciar sesión.";
  }
  if (status === 404) {
    return "No se encontró el recurso. Actualiza la lista e inténtalo de nuevo.";
  }
  if (status === 409) {
    return "El cambio entra en conflicto con el estado actual. Actualiza e inténtalo de nuevo.";
  }
  if (status === 429) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }
  if (status >= 500) {
    return "El servidor no respondió. Revisa la conexión e inténtalo de nuevo.";
  }
  return "No se pudo completar la acción. Revisa los datos e inténtalo de nuevo.";
}

export async function fetchSuperAdminMetrics(): Promise<SuperAdminMetricsApi> {
  return bffJson<SuperAdminMetricsApi>("/api/superadmin/metrics");
}

export async function fetchSuperAdminTenants(): Promise<SuperAdminTenant[]> {
  return bffJson<SuperAdminTenant[]>("/api/superadmin/tenants");
}

export async function updateTenantActiveStatus(
  id: number,
  active: boolean,
): Promise<SuperAdminTenant> {
  return bffJson<SuperAdminTenant>(`/api/superadmin/tenants/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function updateTenantSubscription(
  id: number,
  payload: { plan: SuperAdminPlan; paymentStatus: SuperAdminPaymentStatus },
): Promise<SuperAdminTenant> {
  return bffJson<SuperAdminTenant>(
    `/api/superadmin/tenants/${id}/subscription`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function impersonateTenant(
  id: number,
): Promise<ImpersonateResult> {
  return bffJson<ImpersonateResult>(
    `/api/superadmin/tenants/${id}/impersonate`,
    { method: "POST" },
  );
}

export async function fetchSuperAdminCoupons(): Promise<SuperAdminCoupon[]> {
  return bffJson<SuperAdminCoupon[]>("/api/superadmin/coupons");
}

export async function createSuperAdminCoupon(
  input: SuperAdminCouponCreateInput,
): Promise<SuperAdminCoupon> {
  return bffJson<SuperAdminCoupon>("/api/superadmin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSuperAdminCoupon(
  id: number,
  input: SuperAdminCouponUpdateInput,
): Promise<SuperAdminCoupon> {
  return bffJson<SuperAdminCoupon>(`/api/superadmin/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
