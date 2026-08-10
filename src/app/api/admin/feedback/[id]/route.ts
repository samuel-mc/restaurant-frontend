import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { resolveFeedbackRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/feedback/:id */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = await parseJsonBody(request, resolveFeedbackRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/feedback/${encodeURIComponent(id)}`,
    { method: "PATCH", body: parsed.data },
  );
}
