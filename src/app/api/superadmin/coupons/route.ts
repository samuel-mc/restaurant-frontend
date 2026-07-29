import { proxySuperAdminRequest } from "@/lib/superadmin-api-proxy";

export async function GET(request: Request) {
  return proxySuperAdminRequest(request, "/api/v1/superadmin/coupons", {
    method: "GET",
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxySuperAdminRequest(request, "/api/v1/superadmin/coupons", {
    method: "POST",
    body,
  });
}
