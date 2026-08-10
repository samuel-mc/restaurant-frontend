import { proxySuperAdminRequest } from "@/lib/superadmin-api-proxy";
import { superAdminCouponCreateRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

export async function GET(request: Request) {
  return proxySuperAdminRequest(request, "/api/v1/superadmin/coupons", {
    method: "GET",
  });
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, superAdminCouponCreateRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxySuperAdminRequest(request, "/api/v1/superadmin/coupons", {
    method: "POST",
    body: parsed.data,
  });
}
