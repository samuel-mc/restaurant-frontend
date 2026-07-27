import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { OrdersBoard } from "@/components/admin/orders-board";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import { listOrders } from "@/services/adminOrderQueries";
import { ApiError } from "@/services/apiClient";
import type { OrderPage } from "@/types/api";

export const metadata: Metadata = {
  title: "Pedidos · Panel",
  description: "Historial y detalle de pedidos del restaurante.",
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Listado y control de pedidos/cuentas (admin).
 */
export default async function AdminOrdersPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Tenant no identificado
        </h1>
        <p className="text-sm text-muted-foreground">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  let initialPage: OrderPage | null = null;
  let loadError: string | null = null;

  try {
    initialPage = await listOrders({
      tenantSlug,
      filter: "ALL",
      page: 0,
      size: 20,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    loadError =
      error instanceof ApiError
        ? error.message
        : "No pudimos cargar el listado de pedidos.";
  }

  if (loadError || !initialPage) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16 font-jakarta-sans">
        <h1 className="text-2xl font-bold tracking-tight">
          Pedidos no disponibles
        </h1>
        <p className="text-sm text-muted-foreground">
          {loadError ?? "Error desconocido."}
        </p>
        <Link
          href="/admin/dashboard/orders"
          className={`mt-2 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground ${focusRing}`}
        >
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Link>
      </div>
    );
  }

  return (
    <OrdersBoard
      tenantSlug={tenantSlug}
      restaurantName={prettifyTenantSlug(tenantSlug)}
      initialPage={initialPage}
      initialFilter="ALL"
    />
  );
}
