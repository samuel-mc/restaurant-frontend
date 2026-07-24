import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PATCH /api/admin/orders/:uuid/close → cierre/cobro de cuenta */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/orders/${encodeURIComponent(uuid)}/close`,
    { method: "PATCH" },
  );
}
