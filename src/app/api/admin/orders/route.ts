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

/** POST /api/admin/orders → comanda manual del mesero */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, "/api/v1/admin/orders", {
    method: "POST",
    body,
  });
}
