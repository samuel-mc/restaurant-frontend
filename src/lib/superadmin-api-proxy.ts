/**
 * Proxy same-origin hacia API SuperAdmin (JWT global, sin X-Tenant).
 */

import { NextResponse } from "next/server";
import { getSuperAdminAccessToken } from "@/lib/superadmin-auth-server";

function resolveApiBase(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  return apiUrl || null;
}

function upstreamErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }
  return fallback;
}

export async function proxySuperAdminRequest(
  _request: Request,
  upstreamPath: string,
  options: {
    method: string;
    body?: unknown;
  },
): Promise<NextResponse> {
  const token = await getSuperAdminAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Sesión SuperAdmin expirada. Vuelve a iniciar sesión." },
      { status: 401 },
    );
  }

  const apiUrl = resolveApiBase();
  if (!apiUrl) {
    return NextResponse.json(
      { error: "Falta NEXT_PUBLIC_API_URL." },
      { status: 500 },
    );
  }

  const path = upstreamPath.startsWith("/")
    ? upstreamPath
    : `/${upstreamPath}`;

  const upstream = await fetch(`${apiUrl}${path}`, {
    method: options.method,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${token}`,
    },
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: upstreamErrorMessage(
          payload,
          "La operación en el backend falló.",
        ),
      },
      { status: upstream.status },
    );
  }

  return NextResponse.json(payload, { status: upstream.status });
}
