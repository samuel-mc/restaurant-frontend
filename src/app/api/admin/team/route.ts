import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** GET /api/admin/team → Spring `/api/v1/admin/team` */
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/api/v1/admin/team", { method: "GET" });
}

/** POST /api/admin/team → Spring `/api/v1/admin/team` */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, "/api/v1/admin/team", {
    method: "POST",
    body,
  });
}
