import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { OrdersBoard } from "@/components/admin/orders-board";
import { WaiterTablesBoard } from "@/components/admin/waiter-tables-board";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import {
  extractRoleFromToken,
  normalizePanelRole,
  STAFF_LOGIN_PATH,
} from "@/lib/jwt-payload";
import { getActiveOrders, listOrders } from "@/services/adminOrderQueries";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";
import { getTableFloorConfig } from "@/services/adminTableQueries";
import { ApiError } from "@/services/apiClient";
import type { Order, OrderPage, RestaurantProfile } from "@/types/api";
import { ticketInfoFromProfile } from "@/lib/ticket-from-order";

export const metadata: Metadata = {
  title: "Gestión de Mesas · Panel",
  description: "Mesas, cuentas y cobro del restaurante.",
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Pedidos / mesas. Para ROLE_MESERO es la pantalla de inicio operativa.
 * Admin/owner: salón por defecto; `?vista=historial` para auditoría.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string | string[] }>;
}) {
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
    redirect(STAFF_LOGIN_PATH);
  }

  const role = normalizePanelRole(extractRoleFromToken(token));
  const fallbackName = prettifyTenantSlug(tenantSlug);
  const query = await searchParams;
  const vistaRaw = Array.isArray(query.vista) ? query.vista[0] : query.vista;
  const showHistory =
    role !== "MESERO" && vistaRaw?.trim().toLowerCase() === "historial";

  let profile: RestaurantProfile | null = null;
  try {
    profile = await getRestaurantProfile(tenantSlug);
  } catch {
    profile = null;
  }
  const restaurantName = profile?.name?.trim() || fallbackName;
  const restaurantInfo = ticketInfoFromProfile(
    profile,
    fallbackName,
    tenantSlug,
  );

  if (!showHistory) {
    let activeOrders: Order[] = [];
    let tableCount = profile?.tableCount ?? 12;
    let loadError: string | null = null;
    try {
      const [orders, floor] = await Promise.all([
        getActiveOrders(tenantSlug),
        getTableFloorConfig(tenantSlug),
      ]);
      activeOrders = orders;
      tableCount = floor.tableCount;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(STAFF_LOGIN_PATH);
      }
      loadError =
        error instanceof ApiError
          ? error.message
          : "No pudimos cargar las mesas activas.";
    }

    if (loadError) {
      return (
        <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16 font-jakarta-sans">
          <h1 className="text-2xl font-bold tracking-tight">
            Mesas no disponibles
          </h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
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
      <WaiterTablesBoard
        tenantSlug={tenantSlug}
        restaurantName={restaurantName}
        restaurantInfo={restaurantInfo}
        initialOrders={activeOrders}
        floorSize={tableCount}
        historyHref={
          role === "MESERO" ? null : "/admin/dashboard/orders?vista=historial"
        }
      />
    );
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
      redirect(STAFF_LOGIN_PATH);
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
          href="/admin/dashboard/orders?vista=historial"
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
      restaurantName={restaurantName}
      restaurantInfo={restaurantInfo}
      initialPage={initialPage}
      initialFilter="ALL"
      salonHref="/admin/dashboard/orders"
    />
  );
}
