import { NextResponse } from "next/server";
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_MAX_AGE_SECONDS,
} from "@/lib/auth-cookie";
import {
  cookieMaxAgeSecondsForToken,
  isTokenExpired,
} from "@/lib/jwt-payload";
import { isSameOriginRequest, looksLikeJwt } from "@/lib/same-origin";

type Body = {
  code?: unknown;
};

/**
 * Canjea el código de handoff de impersonación en el subdominio del tenant
 * y establece la cookie HttpOnly. El JWT nunca pasa por el hash de la URL.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 128) {
    return NextResponse.json(
      { error: "Se requiere un código de impersonación válido." },
      { status: 400 },
    );
  }

  const tenantSlug =
    request.headers.get("x-tenant-slug")?.trim().toLowerCase() ||
    request.headers.get("X-Tenant")?.trim().toLowerCase() ||
    "";
  if (!tenantSlug) {
    return NextResponse.json(
      { error: "Falta el identificador del restaurante." },
      { status: 400 },
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    return NextResponse.json(
      { error: "Falta NEXT_PUBLIC_API_URL." },
      { status: 500 },
    );
  }

  const upstream = await fetch(`${apiUrl}/api/v1/auth/impersonation/redeem`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Tenant": tenantSlug,
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  const payload = (await upstream.json().catch(() => null)) as {
    token?: string;
    error?: string;
  } | null;

  if (!upstream.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "No se pudo canjear el código de impersonación.";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token || !looksLikeJwt(token) || isTokenExpired(token)) {
    return NextResponse.json(
      { error: "El servidor devolvió un token inválido." },
      { status: 502 },
    );
  }

  const maxAge = cookieMaxAgeSecondsForToken(
    token,
    ADMIN_TOKEN_MAX_AGE_SECONDS,
  );
  if (maxAge <= 0) {
    return NextResponse.json(
      { error: "El token de soporte ya expiró." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
