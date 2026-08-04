import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/orders/active → snapshot de comandas activas (BFF) */
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/orders/active", {
    method: "GET",
  });
}
