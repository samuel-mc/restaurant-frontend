/**
 * Helpers de sesión SuperAdmin (Server Components).
 */

import "server-only";

import { redirect } from "next/navigation";
import { getSuperAdminAccessToken } from "@/lib/superadmin-auth-server";

export async function requireSuperAdminSession(): Promise<string> {
  const token = await getSuperAdminAccessToken();
  if (!token) redirect("/superadmin/login");
  return token;
}
