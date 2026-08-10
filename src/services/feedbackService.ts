/**
 * Smart Rating (feedback post-CLOSED) — API pública del comensal.
 */

import type {
  FeedbackStatusResponse,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
} from "@/types/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { submitFeedbackSchema } from "@/lib/validation/schemas";
import { assertValid } from "@/lib/validation/parse";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";

function feedbackPath(orderUuid: string): string {
  return `/api/v1/orders/${encodeURIComponent(orderUuid)}/feedback`;
}

export async function getFeedbackStatus(
  orderUuid: string,
  tenantSlug?: string | null,
): Promise<FeedbackStatusResponse> {
  const slug = resolveTenantSlug(tenantSlug);
  return apiClient.get<FeedbackStatusResponse>(feedbackPath(orderUuid), {
    headers: { [TENANT_HEADER]: slug },
    cache: "no-store",
  });
}

export async function submitOrderFeedback(
  orderUuid: string,
  body: SubmitFeedbackRequest,
  tenantSlug?: string | null,
): Promise<SubmitFeedbackResponse> {
  const slug = resolveTenantSlug(tenantSlug);
  const validated = assertValid(submitFeedbackSchema, body, feedbackPath(orderUuid));
  return apiClient.post<SubmitFeedbackResponse>(feedbackPath(orderUuid), validated, {
    headers: { [TENANT_HEADER]: slug },
    cache: "no-store",
  });
}

export function getFeedbackErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return error.message || "Ya enviaste tu evaluación para este pedido.";
    }
    if (error.status === 429) {
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    }
    if (error.message && !/localhost|NEXT_PUBLIC|CORS|API_URL/i.test(error.message)) {
      return error.message;
    }
  }
  return "No pudimos enviar tu evaluación. Intenta de nuevo.";
}

const STORAGE_PREFIX = "pl-feedback-done:";

export function markFeedbackSubmittedLocally(orderUuid: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${orderUuid}`, "1");
  } catch {
    // private mode / blocked storage
  }
}

export function wasFeedbackSubmittedLocally(orderUuid: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${orderUuid}`) === "1";
  } catch {
    return false;
  }
}
