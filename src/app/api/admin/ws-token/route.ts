import { NextResponse } from "next/server";
import { getAdminAccessToken } from "@/lib/auth-server";
import { isTokenExpired } from "@/lib/jwt-payload";
import { isSameOriginRequest } from "@/lib/same-origin";

/**
 * Entrega el JWT admin al cliente solo para autenticar STOMP (WebSocket).
 * Same-origin + cookie HttpOnly; el token no se persiste en localStorage.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const token = await getAdminAccessToken();
  if (!token || isTokenExpired(token)) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  return NextResponse.json(
    { token },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
