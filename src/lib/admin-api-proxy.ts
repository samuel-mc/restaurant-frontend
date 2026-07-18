/**
 * Proxy same-origin hacia el API admin de Spring Boot.
 * Inyecta JWT HttpOnly + X-Tenant desde la petición del cliente.
 */

import { NextResponse } from "next/server";
import { getAdminAccessToken } from "@/lib/auth-server";

function resolveApiBase(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  return apiUrl || null;
}

function extractTenantSlug(request: Request): string {
  return (
    request.headers.get("x-tenant-slug")?.trim() ||
    request.headers.get("X-Tenant")?.trim() ||
    ""
  );
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

async function requireAdminProxyContext(request: Request): Promise<
  | { ok: true; token: string; tenantSlug: string; apiUrl: string }
  | { ok: false; response: NextResponse }
> {
  const token = await getAdminAccessToken();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sesión expirada. Vuelve a iniciar sesión." },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = extractTenantSlug(request);
  if (!tenantSlug) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Falta el identificador del restaurante." },
        { status: 400 },
      ),
    };
  }

  const apiUrl = resolveApiBase();
  if (!apiUrl) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Falta NEXT_PUBLIC_API_URL." },
        { status: 500 },
      ),
    };
  }

  return { ok: true, token, tenantSlug, apiUrl };
}

export async function proxyAdminRequest(
  request: Request,
  upstreamPath: string,
  options: {
    method: string;
    body?: unknown;
    emptyResponse?: boolean;
  },
): Promise<NextResponse> {
  const ctx = await requireAdminProxyContext(request);
  if (!ctx.ok) return ctx.response;

  const path = upstreamPath.startsWith("/")
    ? upstreamPath
    : `/${upstreamPath}`;

  const upstream = await fetch(`${ctx.apiUrl}${path}`, {
    method: options.method,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${ctx.token}`,
      "X-Tenant": ctx.tenantSlug,
    },
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (options.emptyResponse || upstream.status === 204) {
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null);
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
    return new NextResponse(null, { status: 204 });
  }

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

/**
 * Reenvía FormData multipart al backend.
 * No fijar Content-Type: el runtime añade el boundary automáticamente.
 */
export async function proxyAdminMultipart(
  request: Request,
  upstreamPath: string,
  method: "POST" | "PUT" = "POST",
): Promise<NextResponse> {
  const ctx = await requireAdminProxyContext(request);
  if (!ctx.ok) return ctx.response;

  const path = upstreamPath.startsWith("/")
    ? upstreamPath
    : `/${upstreamPath}`;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Formulario multipart inválido." },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${ctx.apiUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${ctx.token}`,
      "X-Tenant": ctx.tenantSlug,
    },
    body: formData,
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
