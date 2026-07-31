/**
 * Inbox Smart Rating (admin) vía BFF same-origin.
 */

import type {
  AdminFeedbackItem,
  FeedbackInboxStatus,
  FeedbackSummary,
} from "@/types/api";
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

export async function fetchFeedbackSummary(
  tenantSlug: string,
): Promise<FeedbackSummary> {
  return bffJson<FeedbackSummary>(
    "/api/admin/feedback/summary",
    tenantSlug,
  );
}

export async function fetchFeedbackInbox(
  tenantSlug: string,
  options?: {
    status?: FeedbackInboxStatus | "ALL";
    urgentOnly?: boolean;
  },
): Promise<AdminFeedbackItem[]> {
  const params = new URLSearchParams();
  if (options?.status && options.status !== "ALL") {
    params.set("status", options.status);
  }
  if (options?.urgentOnly) {
    params.set("urgentOnly", "true");
  }
  const qs = params.toString();
  return bffJson<AdminFeedbackItem[]>(
    `/api/admin/feedback${qs ? `?${qs}` : ""}`,
    tenantSlug,
  );
}

export async function resolveFeedback(
  id: number,
  status: Extract<FeedbackInboxStatus, "RESOLVED" | "DISMISSED">,
  tenantSlug: string,
): Promise<AdminFeedbackItem> {
  return bffJson<AdminFeedbackItem>(`/api/admin/feedback/${id}`, tenantSlug, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
