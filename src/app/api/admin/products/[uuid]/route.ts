import { proxyAdminMultipart, proxyAdminRequest } from "@/lib/admin-api-proxy";
import { productRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PUT /api/admin/products/[uuid] — JSON o multipart */
export async function PUT(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return proxyAdminMultipart(
      request,
      `/api/v1/admin/products/${uuid}`,
      "PUT",
    );
  }

  const parsed = await parseJsonBody(request, productRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, `/api/v1/admin/products/${uuid}`, {
    method: "PUT",
    body: parsed.data,
  });
}

/** DELETE /api/admin/products/[uuid] → Spring `/api/v1/admin/products/{uuid}` (204) */
export async function DELETE(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  return proxyAdminRequest(request, `/api/v1/admin/products/${uuid}`, {
    method: "DELETE",
    emptyResponse: true,
  });
}
