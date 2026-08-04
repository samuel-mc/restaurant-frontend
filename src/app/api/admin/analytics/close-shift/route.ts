import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** POST /api/admin/analytics/close-shift → Spring `/api/v1/admin/analytics/close-shift` */
export async function POST(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/analytics/close-shift", {
    method: "POST",
  });
}
