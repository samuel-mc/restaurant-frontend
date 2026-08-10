import { proxyAdminRequest } from "@/lib/admin-api-proxy";
import { staffOrderRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

/** GET /api/admin/orders → listado paginado admin */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = query
    ? `/api/v1/admin/orders?${query}`
    : "/api/v1/admin/orders";
  return proxyAdminRequest(request, path, { method: "GET" });
}

/** POST /api/admin/orders → comanda manual del mesero */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, staffOrderRequestSchema);
  if (!parsed.ok) return parsed.response;
  return proxyAdminRequest(request, "/api/v1/admin/orders", {
    method: "POST",
    body: parsed.data,
  });
}
