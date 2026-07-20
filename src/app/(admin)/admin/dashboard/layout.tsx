import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { prettifyTenantSlug } from "@/lib/admin-nav";

/**
 * Layout compartido del dashboard: sidebar + módulos.
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
