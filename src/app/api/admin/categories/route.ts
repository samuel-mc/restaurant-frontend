import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** POST /api/admin/categories → Spring `/api/v1/admin/categories` */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, "/api/v1/admin/categories", {
    method: "POST",
    body,
  });
}
