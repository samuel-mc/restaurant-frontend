import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KitchenDashboard } from "@/components/admin/kitchen-dashboard";
import { getAdminAccessToken } from "@/lib/auth-server";
import { getActiveOrders } from "@/services/adminOrderQueries";
import { ApiError } from "@/services/apiClient";
import type { Order } from "@/types/api";

export const metadata: Metadata = {
  title: "Cocina · Dashboard",
  description: "Monitor en tiempo real de comandas activas.",
};

function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Monitor de cocina/caja.
 *
 * Server: snapshot autenticado de órdenes activas.
 * Client: STOMP `/topic/admin/{tenant}/orders` + acciones PATCH vía BFF.
 */
export default async function AdminDashboardPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6">
        <h1 className="text-2xl font-bold">Tenant no identificado</h1>
        <p className="text-sm text-foreground/60">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </main>
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
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6">
        <h1 className="text-2xl font-bold">Monitor no disponible</h1>
        <p className="text-sm text-foreground/60">{loadError}</p>
      </main>
    );
  }

  return (
    <KitchenDashboard
      tenantSlug={tenantSlug}
      restaurantName={prettifyTenant(tenantSlug)}
      initialOrders={initialOrders}
    />
  );
}
