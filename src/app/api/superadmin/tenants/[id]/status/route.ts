import { proxySuperAdminRequest } from "@/lib/superadmin-api-proxy";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  return proxySuperAdminRequest(
    request,
    `/api/v1/superadmin/tenants/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body },
  );
}
