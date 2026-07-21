import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** PUT /api/admin/categories/[id] → Spring `/api/v1/admin/categories/{id}` */
export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, `/api/v1/admin/categories/${id}`, {
    method: "PUT",
    body,
  });
}

/** DELETE /api/admin/categories/[id] → Spring `/api/v1/admin/categories/{id}` (204) */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyAdminRequest(request, `/api/v1/admin/categories/${id}`, {
    method: "DELETE",
    emptyResponse: true,
  });
}
