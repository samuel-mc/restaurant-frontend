/**
 * Billing early access: canje de cupones vía BFF.
 */

import type { RedeemCouponResponse } from "@/types/billing";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

export async function redeemCoupon(
  code: string,
  tenantSlug: string,
): Promise<RedeemCouponResponse> {
  const slug = resolveTenantSlug(tenantSlug);
  const response = await fetch("/api/admin/billing/redeem-coupon", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });

  const body = (await response.json().catch(() => null)) as
    | RedeemCouponResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudo canjear el cupón.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url: "/api/admin/billing/redeem-coupon",
      body,
    });
  }

  return body as RedeemCouponResponse;
}
