import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { KitchenDashboard } from "@/components/admin/kitchen-dashboard";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import {
  extractRoleFromToken,
  normalizePanelRole,
  STAFF_LOGIN_PATH,
} from "@/lib/jwt-payload";
import { getActiveOrders } from "@/services/adminOrderQueries";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";
import { ApiError } from "@/services/apiClient";
import type { Order, RestaurantProfile } from "@/types/api";
import { ticketInfoFromProfile } from "@/lib/ticket-from-order";

export const metadata: Metadata = {
  title: "Monitor de Cocina · Panel",
  description: "Monitor en tiempo real de comandas activas.",
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function parseOrderUuid(
  raw: string | string[] | undefined,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Cocina — monitor reactivo (WebSockets / STOMP).
 * Para ROLE_COCINA es la pantalla de inicio (KDS tablet).
 */
export default async function AdminKitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
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
  const kdsMode = role === "COCINA";
  const fallbackName = prettifyTenantSlug(tenantSlug);

  const query = await searchParams;
  const focusOrderUuid = parseOrderUuid(query.order);

  let initialOrders: Order[] = [];
  let loadError: string | null = null;
  let profile: RestaurantProfile | null = null;

  try {
    const [orders, restaurantProfile] = await Promise.all([
      getActiveOrders(tenantSlug),
      getRestaurantProfile(tenantSlug).catch(() => null),
    ]);
    initialOrders = orders;
    profile = restaurantProfile;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(STAFF_LOGIN_PATH);
    }
    loadError =
      error instanceof ApiError
        ? error.message
        : "No pudimos cargar las comandas activas.";
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16 font-jakarta-sans">
        <h1 className="text-2xl font-bold tracking-tight">
          Monitor no disponible
        </h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <p className="text-sm text-muted-foreground">
          Revisa la conexión e inténtalo de nuevo. Sin comandas no se puede
          operar cocina.
        </p>
        <Link
          href="/admin/dashboard/kitchen"
          className={`mt-2 inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground ${focusRing}`}
        >
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Link>
      </div>
    );
  }

  const restaurantName = profile?.name?.trim() || fallbackName;

  return (
    <KitchenDashboard
      tenantSlug={tenantSlug}
      restaurantName={restaurantName}
      restaurantInfo={ticketInfoFromProfile(
        profile,
        fallbackName,
        tenantSlug,
      )}
      initialOrders={initialOrders}
      focusOrderUuid={focusOrderUuid}
      kdsMode={kdsMode}
    />
  );
}
