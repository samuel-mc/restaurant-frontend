import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/feedback/summary */
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/feedback/summary", {
    method: "GET",
  });
}
