import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/tables/config → total de mesas del piso */
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/tables/config", {
    method: "GET",
  });
}
