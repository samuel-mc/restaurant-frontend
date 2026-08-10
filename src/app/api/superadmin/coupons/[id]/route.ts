import { proxySuperAdminRequest } from "@/lib/superadmin-api-proxy";
import { superAdminCouponUpdateRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = await parseJsonBody(request, superAdminCouponUpdateRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxySuperAdminRequest(
    request,
    `/api/v1/superadmin/coupons/${encodeURIComponent(id)}`,
    { method: "PATCH", body: parsed.data },
  );
}
