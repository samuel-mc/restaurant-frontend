/**
 * Navegación del panel filtrada por rol de sesión.
 */

import type { AdminNavItem } from "@/lib/admin-nav";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { normalizePanelRole } from "@/lib/jwt-payload";

/**
 * Devuelve solo los ítems cuyo `roles[]` incluye el rol de la sesión.
 * Sin rol conocido → nav completa de admin (compat dueño email).
 */
export function navItemsForRole(
  role: string | null | undefined,
): readonly AdminNavItem[] {
  const normalized = normalizePanelRole(role);
  if (!normalized) {
    return ADMIN_NAV.filter((item) =>
      item.roles.includes("OWNER") || item.roles.includes("ADMIN"),
    );
  }

  return ADMIN_NAV.filter((item) => item.roles.includes(normalized));
}
