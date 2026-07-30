import { NextResponse } from "next/server";
import { proxyAdminRequest } from "@/lib/admin-api-proxy";

/** POST /api/admin/tables/merge → unión de mesas */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  return proxyAdminRequest(request, "/api/v1/admin/tables/merge", {
    method: "POST",
    body,
  });
}
