import { proxyAdminRequest } from "@/lib/admin-api-proxy";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/** PATCH /api/admin/products/[uuid]/toggle-availability */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  return proxyAdminRequest(
    request,
    `/api/v1/admin/products/${uuid}/toggle-availability`,
    { method: "PATCH" },
  );
}
