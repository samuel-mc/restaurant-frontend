/**
 * Lectura del JWT admin desde la cookie HttpOnly.
 * SOLO Server Components / Route Handlers / Server Actions.
 */

import "server-only";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth-cookie";

/** Devuelve el JWT admin o `null` si no hay sesión. */
export async function getAdminAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_TOKEN_COOKIE)?.value?.trim();
  return token || null;
}

/**
 * Cabecera `Authorization: Bearer …` lista para pasar a `apiClient`
 * desde un Server Component / Server Action.
 */
export async function getAdminAuthHeaders(): Promise<HeadersInit> {
  const token = await getAdminAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
