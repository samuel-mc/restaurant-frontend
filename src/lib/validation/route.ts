/**
 * Helpers de validación zod para Route Handlers del BFF (server-only).
 * Validan el cuerpo JSON entrante antes de reenviarlo al backend,
 * devolviendo 400 con el primer mensaje si no cumple el esquema.
 */

import "server-only";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** Devuelve el primer mensaje legible de un error de zod. */
export function firstValidationMessage(error: unknown): string {
  if (error instanceof ZodError && error.issues.length > 0) {
    return error.issues[0].message;
  }
  return "Cuerpo inválido.";
}

/**
 * Lee y valida el cuerpo JSON de un Route Handler del BFF.
 * @param request Request entrante del Route Handler.
 * @param schema Esquema zod que debe cumplir el payload.
 * @param fallback Mensaje para JSON malformado (por defecto "Cuerpo inválido.").
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  fallback = "Cuerpo inválido.",
): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: fallback }, { status: 400 }) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: firstValidationMessage(result.error) }, { status: 400 }),
    };
  }

  return { ok: true, data: result.data };
}
