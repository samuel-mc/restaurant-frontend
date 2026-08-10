import { NextResponse } from "next/server";
import { getAdminAccessToken } from "@/lib/auth-server";
import { orderStatusRequestSchema } from "@/lib/validation/schemas";
import { parseJsonBody } from "@/lib/validation/route";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

/**
 * BFF: reenvía el cambio de estado al backend con JWT HttpOnly + X-Tenant.
 * PATCH /api/admin/orders/[uuid]/status
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { uuid } = await context.params;
  const token = await getAdminAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Sesión expirada. Vuelve a iniciar sesión." },
      { status: 401 },
    );
  }

  const tenantSlug =
    request.headers.get("x-tenant-slug")?.trim() ||
    request.headers.get("X-Tenant")?.trim() ||
    "";
  if (!tenantSlug) {
    return NextResponse.json(
      { error: "Falta el identificador del restaurante." },
      { status: 400 },
    );
  }

  const parsed = await parseJsonBody(request, orderStatusRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.data;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    return NextResponse.json(
      { error: "Falta NEXT_PUBLIC_API_URL." },
      { status: 500 },
    );
  }

  const upstream = await fetch(
    `${apiUrl}/api/v1/admin/orders/${uuid}/status`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant": tenantSlug,
      },
      body: JSON.stringify({ status }),
      cache: "no-store",
    },
  );

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "No se pudo actualizar el pedido en el backend.";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  return NextResponse.json(payload);
}
