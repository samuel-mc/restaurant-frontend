import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PATCH /api/admin/orders/:uuid/close → cierre/cobro de cuenta */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  return proxyAdminRequest(
    request,
    `/api/v1/admin/orders/${encodeURIComponent(uuid)}/close`,
    { method: "PATCH", body },
  );
}
