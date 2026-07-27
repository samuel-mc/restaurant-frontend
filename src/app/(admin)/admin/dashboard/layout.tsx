import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminAccessToken } from "@/lib/auth-server";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";

/**
 * Layout persistente del dashboard admin.
 *
 * Rutas hijas (todas envueltas por el sidebar):
 * - `/admin/dashboard`           → métricas / analíticas
 * - `/admin/dashboard/kitchen`   → cocina en vivo (WebSockets)
 * - `/admin/dashboard/orders`    → pedidos / cuentas
 * - `/admin/dashboard/qr`        → códigos QR de menú y mesas
 * - `/admin/dashboard/menu`      → catálogo
 * - `/admin/dashboard/settings`  → configuración
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

  if (tenantSlug) {
    const token = await getAdminAccessToken();
    if (token) {
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
    >
      {children}
    </AdminShell>
  );
}
