import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { prettifyTenantSlug } from "@/lib/admin-nav";

/**
 * Layout persistente del dashboard admin.
 *
 * Rutas hijas (todas envueltas por el sidebar):
 * - `/admin/dashboard`           → métricas / analíticas
 * - `/admin/dashboard/kitchen`   → cocina en vivo (WebSockets)
 * - `/admin/dashboard/menu`      → catálogo
 * - `/admin/dashboard/settings`  → configuración
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";

  return (
    <AdminShell
      tenantSlug={tenantSlug || "restaurante"}
      restaurantName={
        tenantSlug ? prettifyTenantSlug(tenantSlug) : "Restaurante"
      }
    >
      {children}
    </AdminShell>
  );
}
