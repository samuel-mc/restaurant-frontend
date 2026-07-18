import { proxyAdminMultipart, proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PUT /api/admin/products/[uuid] — JSON o multipart */
export async function PUT(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return proxyAdminMultipart(
      request,
      `/api/v1/admin/products/${uuid}`,
      "PUT",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, `/api/v1/admin/products/${uuid}`, {
    method: "PUT",
    body,
  });
}
