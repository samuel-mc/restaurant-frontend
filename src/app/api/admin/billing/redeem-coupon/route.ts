import { proxyAdminRequest } from "@/lib/admin-api-proxy";

const UPSTREAM = "/api/v1/admin/billing/redeem-coupon";

/** POST /api/admin/billing/redeem-coupon */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, UPSTREAM, {
    method: "POST",
    body,
  });
}
