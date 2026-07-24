import { proxyAdminMultipart } from "@/lib/admin-api-proxy";

/** POST /api/admin/menu/upload-excel → importación masiva */
export async function POST(request: Request) {
  return proxyAdminMultipart(
    request,
    "/api/v1/admin/menu/upload-excel",
    "POST",
  );
}
