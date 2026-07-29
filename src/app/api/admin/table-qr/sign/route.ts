import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** POST /api/admin/table-qr/sign → Spring `/api/v1/admin/table-qr/sign` */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, "/api/v1/admin/table-qr/sign", {
    method: "POST",
    body,
  });
}
