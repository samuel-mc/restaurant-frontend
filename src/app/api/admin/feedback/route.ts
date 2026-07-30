import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/feedback → Spring `/api/v1/admin/feedback` */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  return proxyAdminRequest(
    request,
    `/api/v1/admin/feedback${qs ? `?${qs}` : ""}`,
    { method: "GET" },
  );
}
