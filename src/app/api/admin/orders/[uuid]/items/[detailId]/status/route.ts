import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ uuid: string; detailId: string }>;
};

/** PATCH /api/admin/orders/:uuid/items/:detailId/status */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid, detailId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(
    request,
    `/api/v1/admin/orders/${encodeURIComponent(uuid)}/items/${encodeURIComponent(detailId)}/status`,
    { method: "PATCH", body },
  );
}
