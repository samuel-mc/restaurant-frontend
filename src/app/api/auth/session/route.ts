import { NextResponse } from "next/server";
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_MAX_AGE_SECONDS,
} from "@/lib/auth-cookie";
import { getAdminAccessToken } from "@/lib/auth-server";
import {
  cookieMaxAgeSecondsForToken,
  isTokenExpired,
} from "@/lib/jwt-payload";
import { isSameOriginRequest, looksLikeJwt } from "@/lib/same-origin";

type SessionBody = {
  token?: unknown;
};

/**
 * Establece la cookie HttpOnly con el JWT admin.
 * Solo acepta peticiones same-origin (el formulario de login).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || !looksLikeJwt(token) || isTokenExpired(token)) {
    return NextResponse.json(
      { error: "Se requiere un token válido." },
      { status: 400 },
    );
  }

  const maxAge = cookieMaxAgeSecondsForToken(
    token,
    ADMIN_TOKEN_MAX_AGE_SECONDS,
  );
  if (maxAge <= 0) {
    return NextResponse.json(
      { error: "Se requiere un token válido." },
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

/** Revoca el JWT en el backend y elimina la cookie. */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const token = await getAdminAccessToken();
  if (token) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (apiUrl) {
      const tenantSlug =
        request.headers.get("x-tenant-slug")?.trim() ||
        request.headers.get("X-Tenant")?.trim() ||
        "";
      try {
        await fetch(`${apiUrl}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(tenantSlug ? { "X-Tenant": tenantSlug } : {}),
          },
          cache: "no-store",
        });
      } catch {
        // Seguimos limpiando la cookie aunque el backend no responda.
      }
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_TOKEN_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
