import { proxyAdminBinaryDownload } from "@/lib/admin-api-proxy";

/** GET /api/admin/menu/template → plantilla Excel autenticada */
export async function GET(request: Request) {
  return proxyAdminBinaryDownload(request, "/api/v1/admin/menu/template");
}
