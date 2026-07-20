import { proxyAdminMultipart, proxyAdminRequest } from "@/lib/admin-api-proxy";

const UPSTREAM = "/api/v1/admin/restaurants/profile";

/** GET /api/admin/restaurants/profile (opcional; el SSR usa queries directas). */
export async function GET(request: Request) {
  return proxyAdminRequest(request, UPSTREAM, { method: "GET" });
}

/** PUT /api/admin/restaurants/profile — JSON o multipart */
export async function PUT(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return proxyAdminMultipart(request, UPSTREAM, "PUT");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, UPSTREAM, {
    method: "PUT",
    body,
  });
}
