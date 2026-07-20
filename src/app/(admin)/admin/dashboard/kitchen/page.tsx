import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KitchenDashboard } from "@/components/admin/kitchen-dashboard";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import { getActiveOrders } from "@/services/adminOrderQueries";
import { ApiError } from "@/services/apiClient";
import type { Order } from "@/types/api";

export const metadata: Metadata = {
  title: "Operación · Cocina",
  description: "Monitor en tiempo real de comandas activas.",
};

/**
 * Módulo Operación — monitor de cocina/caja.
 */
export default async function AdminKitchenPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold">Tenant no identificado</h1>
        <p className="text-sm text-foreground/60">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  let initialOrders: Order[] = [];
  let loadError: string | null = null;

  try {
    initialOrders = await getActiveOrders(tenantSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    loadError =
      error instanceof ApiError
        ? error.message
        : "No pudimos cargar las comandas activas.";
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold">Monitor no disponible</h1>
        <p className="text-sm text-foreground/60">{loadError}</p>
      </div>
    );
  }

  return (
    <KitchenDashboard
      tenantSlug={tenantSlug}
      restaurantName={prettifyTenantSlug(tenantSlug)}
      initialOrders={initialOrders}
    />
  );
}
