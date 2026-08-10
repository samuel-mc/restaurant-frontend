import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { tableMergeRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

/** POST /api/admin/tables/merge → unión de mesas */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, tableMergeRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, "/api/v1/admin/tables/merge", {
    method: "POST",
    body: parsed.data,
  });
}
