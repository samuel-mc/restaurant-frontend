import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { staffMemberRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

/** GET /api/admin/team → Spring `/api/v1/admin/team` */
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/team", { method: "GET" });
}

/** POST /api/admin/team → Spring `/api/v1/admin/team` */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, staffMemberRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, "/api/v1/admin/team", {
    method: "POST",
    body: parsed.data,
  });
}
