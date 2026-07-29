import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminAccessToken } from "@/lib/auth-server";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { decodeJwtPayload, extractRoleFromToken } from "@/lib/jwt-payload";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";

/**
 * Layout persistente del dashboard admin.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  const fallbackName = tenantSlug
    ? prettifyTenantSlug(tenantSlug)
    : "Restaurante";
  let restaurantName = fallbackName;
  let accessRole: string | null = null;
  let tokenType: string | null = null;
  let impersonatedBy: string | null = null;

  if (tenantSlug) {
    const token = await getAdminAccessToken();
    if (token) {
      accessRole = extractRoleFromToken(token);
      const payload = decodeJwtPayload(token);
      tokenType = payload?.tokenType?.trim() ?? null;
      impersonatedBy = payload?.impersonatedBy?.trim() || null;
      try {
        const profile = await getRestaurantProfile(tenantSlug);
        const name = profile.name?.trim();
        if (name) restaurantName = name;
      } catch {
        // Sin perfil o sin red: usamos el slug embellecido.
      }
    }
  }

  return (
    <AdminShell
      tenantSlug={tenantSlug || "restaurante"}
      restaurantName={restaurantName}
      accessRole={accessRole}
      tokenType={tokenType}
      impersonatedBy={impersonatedBy}
    >
      {children}
    </AdminShell>
  );
}
