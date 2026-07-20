import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KitchenDashboard } from "@/components/admin/kitchen-dashboard";
import { getAdminAccessToken } from "@/lib/auth-server";
import {
  emptyAnalyticsSummary,
  getAnalyticsSummary,
} from "@/services/adminAnalyticsQueries";
import { getActiveOrders } from "@/services/adminOrderQueries";
import { ApiError } from "@/services/apiClient";
import type { AnalyticsSummary } from "@/types/analytics";
import type { Order } from "@/types/api";

export const metadata: Metadata = {
  title: "Dashboard · Analíticas y cocina",
  description: "Métricas de negocio y monitor en tiempo real de comandas.",
};

function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Vista principal del administrador.
 *
 * Server: analytics summary (JWT + X-Tenant) + snapshot de órdenes activas.
 * Client: gráficos Recharts + STOMP de cocina.
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
  let analytics: AnalyticsSummary = emptyAnalyticsSummary("month");
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
        <h1 className="text-2xl font-bold">Dashboard no disponible</h1>
        <p className="text-sm text-foreground/60">{loadError}</p>
      </main>
    );
  }

  try {
    analytics = await getAnalyticsSummary(tenantSlug, "month");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    analytics = emptyAnalyticsSummary("month");
  }

  return (
    <KitchenDashboard
      tenantSlug={tenantSlug}
      restaurantName={prettifyTenant(tenantSlug)}
      initialOrders={initialOrders}
      analytics={analytics}
    />
  );
}
