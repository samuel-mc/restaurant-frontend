import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { categoryRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

/** POST /api/admin/categories → Spring `/api/v1/admin/categories` */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, categoryRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, "/api/v1/admin/categories", {
    method: "POST",
    body: parsed.data,
  });
}
