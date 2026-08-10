import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { staffMemberUpdateRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/team/[id] → Spring `/api/v1/admin/team/{id}` */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = await parseJsonBody(request, staffMemberUpdateRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/team/${encodeURIComponent(id)}`,
    { method: "PATCH", body: parsed.data },
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
