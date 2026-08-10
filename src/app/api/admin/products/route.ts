import { proxyAdminMultipart, proxyAdminRequest } from "@/lib/admin-api-proxy";
import { productRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

/** POST /api/admin/products → JSON o multipart hacia Spring */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return proxyAdminMultipart(request, "/api/v1/admin/products", "POST");
  }

  const parsed = await parseJsonBody(request, productRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, "/api/v1/admin/products", {
    method: "POST",
    body: parsed.data,
  });
}
