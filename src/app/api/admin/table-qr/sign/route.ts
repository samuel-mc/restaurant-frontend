import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { tableQrSignRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

/** POST /api/admin/table-qr/sign → Spring `/api/v1/admin/table-qr/sign` */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, tableQrSignRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, "/api/v1/admin/table-qr/sign", {
    method: "POST",
    body: parsed.data,
  });
}
