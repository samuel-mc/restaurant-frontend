import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/analytics/daily-summary → Spring `/api/v1/admin/analytics/daily-summary` */
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/analytics/daily-summary", {
    method: "GET",
  });
}
