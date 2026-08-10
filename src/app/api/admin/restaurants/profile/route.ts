import { proxyAdminMultipart, proxyAdminRequest } from "@/lib/admin-api-proxy";
import { restaurantProfileRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

const UPSTREAM = "/api/v1/admin/restaurants/profile";

/** GET /api/admin/restaurants/profile (opcional; el SSR usa queries directas). */
export async function GET(request: Request) {
  return proxyAdminRequest(request, UPSTREAM, { method: "GET" });
}

/** PUT /api/admin/restaurants/profile — JSON o multipart */
export async function PUT(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return proxyAdminMultipart(request, UPSTREAM, "PUT");
  }

  const parsed = await parseJsonBody(request, restaurantProfileRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, UPSTREAM, {
    method: "PUT",
    body: parsed.data,
  });
}
