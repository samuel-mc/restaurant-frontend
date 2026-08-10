import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { categoryRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** PUT /api/admin/categories/[id] → Spring `/api/v1/admin/categories/{id}` */
export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = await parseJsonBody(request, categoryRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, `/api/v1/admin/categories/${id}`, {
    method: "PUT",
    body: parsed.data,
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
