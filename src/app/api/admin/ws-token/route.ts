/**
 * Emite ticket STOMP de corta vida vía Spring (`POST /api/v1/admin/ws-ticket`).
 * La cookie HttpOnly nunca se expone: solo el ticket efímero llega al browser.
 */

import { NextResponse } from "next/server";
import { getAdminAccessToken } from "@/lib/auth-server";
import { isTokenExpired } from "@/lib/jwt-payload";
import { isSameOriginRequest } from "@/lib/same-origin";

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

/**
 * Same-origin + cookie HttpOnly → ticket WS (no el JWT de sesión).
 * Query/header: x-tenant-slug para X-Tenant upstream.
 */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const sessionJwt = await getAdminAccessToken();
  if (!sessionJwt || isTokenExpired(sessionJwt)) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const tenantSlug = extractTenantSlug(request);
  if (!tenantSlug) {
    return NextResponse.json(
      { error: "Falta el restaurante (x-tenant-slug)." },
      { status: 400 },
    );
  }

  const apiUrl = resolveApiBase();
  if (!apiUrl) {
    return NextResponse.json(
      { error: "API no configurada." },
      { status: 500 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/api/v1/admin/ws-ticket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionJwt}`,
        "X-Tenant": tenantSlug,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar al servidor." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    let message = "No se pudo emitir el ticket WebSocket.";
    try {
      const body = (await upstream.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const payload = (await upstream.json()) as {
    ticket?: unknown;
    expiresInSeconds?: unknown;
  };
  const ticket = typeof payload.ticket === "string" ? payload.ticket.trim() : "";
  if (!ticket) {
    return NextResponse.json(
      { error: "Respuesta de ticket inválida." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      ticket,
      expiresInSeconds:
        typeof payload.expiresInSeconds === "number"
          ? payload.expiresInSeconds
          : 60,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
