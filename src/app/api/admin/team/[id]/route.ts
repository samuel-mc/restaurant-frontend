import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/team/[id] → Spring `/api/v1/admin/team/{id}` */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(
    request,
    `/api/v1/admin/team/${encodeURIComponent(id)}`,
    { method: "PATCH", body },
  );
}

/** DELETE /api/admin/team/[id] → Spring `/api/v1/admin/team/{id}` */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/team/${encodeURIComponent(id)}`,
    { method: "DELETE", emptyResponse: true },
  );
}
