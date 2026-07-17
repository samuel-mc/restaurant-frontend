/**
 * Lectura del JWT admin desde la cookie HttpOnly (solo Server Components /
 * Route Handlers / Server Actions).
 */

import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth-cookie";

/** Devuelve el JWT admin o `null` si no hay sesión. */
export async function getAdminAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_TOKEN_COOKIE)?.value?.trim();
  return token || null;
}
