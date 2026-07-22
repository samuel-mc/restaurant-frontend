import { proxySuperAdminRequest } from "@/lib/superadmin-api-proxy";

export async function GET(request: Request) {
  return proxySuperAdminRequest(request, "/api/v1/superadmin/tenants", {
    method: "GET",
  });
}
