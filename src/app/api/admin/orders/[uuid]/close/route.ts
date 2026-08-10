import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { closeOrderRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PATCH /api/admin/orders/:uuid/close → cierre/cobro de cuenta */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  const parsed = await parseJsonBody(request, closeOrderRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/orders/${encodeURIComponent(uuid)}/close`,
    { method: "PATCH", body: parsed.data },
  );
}
