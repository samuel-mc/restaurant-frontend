import { proxySuperAdminRequest } from "@/lib/superadmin-api-proxy";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxySuperAdminRequest(
    request,
    `/api/v1/superadmin/tenants/${encodeURIComponent(id)}/impersonate`,
    { method: "POST" },
  );
}
