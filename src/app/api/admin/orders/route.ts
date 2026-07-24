import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/orders → listado paginado admin */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query
    ? `/api/v1/admin/orders?${query}`
    : "/api/v1/admin/orders";
  return proxyAdminRequest(request, path, { method: "GET" });
}
