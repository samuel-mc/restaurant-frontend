import type { DailySummary, ShiftCloseRecord } from "@/types/analytics";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

async function bffJson<T>(
  url: string,
  tenantSlug: string,
  init?: RequestInit,
): Promise<T> {
  const slug = resolveTenantSlug(tenantSlug);
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      "x-tenant-slug": slug,
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "No pudimos completar la operación.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url,
      body: payload,
    });
  }
  return payload as T;
}

export async function fetchDailySummary(tenantSlug: string): Promise<DailySummary> {
  return bffJson<DailySummary>("/api/admin/analytics/daily-summary", tenantSlug);
}

export async function postCloseShift(tenantSlug: string): Promise<ShiftCloseRecord> {
  return bffJson<ShiftCloseRecord>("/api/admin/analytics/close-shift", tenantSlug, {
    method: "POST",
  });
}
