import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { redeemCouponRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

const UPSTREAM = "/api/v1/admin/billing/redeem-coupon";

/** POST /api/admin/billing/redeem-coupon */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, redeemCouponRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, UPSTREAM, {
    method: "POST",
    body: parsed.data,
  });
}
