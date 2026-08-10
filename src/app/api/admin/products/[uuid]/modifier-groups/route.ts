import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { replaceProductModifiersRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PUT /api/admin/products/[uuid]/modifier-groups */
export async function PUT(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  const parsed = await parseJsonBody(request, replaceProductModifiersRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/products/${uuid}/modifier-groups`,
    { method: "PUT", body: parsed.data },
  );
}
