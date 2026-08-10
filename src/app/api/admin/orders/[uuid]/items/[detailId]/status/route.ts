import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { orderItemStatusRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ uuid: string; detailId: string }>;
};

/** PATCH /api/admin/orders/:uuid/items/:detailId/status */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid, detailId } = await context.params;
  const parsed = await parseJsonBody(request, orderItemStatusRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/orders/${encodeURIComponent(uuid)}/items/${encodeURIComponent(detailId)}/status`,
    { method: "PATCH", body: parsed.data },
  );
}
