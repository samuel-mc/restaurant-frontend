/**
 * Helpers de validación zod para la capa de servicios (cliente).
 * Convierten el fallo de zod en un `ApiError` con el primer mensaje
 * (en español, espejo de los mensajes de Bean Validation).
 */

import type { z } from "zod";
import { ZodError } from "zod";
import { ApiError } from "@/services/apiClient";

/** Devuelve el primer mensaje legible de un error de zod. */
export function firstValidationMessage(error: unknown): string {
  if (error instanceof ZodError && error.issues.length > 0) {
    return error.issues[0].message;
  }
  return "Los datos enviados no son válidos.";
}

/**
 * Valida un payload contra el esquema. Lanza `ApiError` 400 si no pasa.
 * @returns El dato ya tipado (zod también aplica transformaciones como trim).
 */
export function assertValid<T>(schema: z.ZodType<T>, value: unknown, url: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      message: firstValidationMessage(result.error),
      status: 400,
      statusText: "Bad Request",
      url,
    });
  }
  return result.data;
}
