/**
 * Lectura del JWT SuperAdmin desde cookie HttpOnly.
 * SOLO Server Components / Route Handlers.
 */

import "server-only";
import { cookies } from "next/headers";
import { SUPERADMIN_TOKEN_COOKIE } from "@/lib/auth-cookie";

export async function getSuperAdminAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SUPERADMIN_TOKEN_COOKIE)?.value?.trim();
  return token || null;
}

export async function getSuperAdminAuthHeaders(): Promise<HeadersInit> {
  const token = await getSuperAdminAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
