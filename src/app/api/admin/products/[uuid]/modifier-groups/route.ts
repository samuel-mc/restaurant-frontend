import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PUT /api/admin/products/[uuid]/modifier-groups */
export async function PUT(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxyAdminRequest(
    request,
    `/api/v1/admin/products/${uuid}/modifier-groups`,
    { method: "PUT", body },
  );
}
