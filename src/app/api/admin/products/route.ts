import { proxyAdminMultipart, proxyAdminRequest } from "@/lib/admin-api-proxy";

/** POST /api/admin/products → JSON o multipart hacia Spring */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return proxyAdminMultipart(request, "/api/v1/admin/products", "POST");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, "/api/v1/admin/products", {
    method: "POST",
    body,
  });
}
