import type { Metadata } from "next";
import { getOrderByUuid } from "@/services/orderService";
import { ApiError } from "@/services/apiClient";
import { OrderTracker } from "@/components/customer/order-tracker";
import { OrderUnavailableState } from "@/components/customer/order-unavailable-state";
import { CustomerBrandHeader } from "@/components/customer/customer-brand-header";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import { brandFromProfile } from "@/lib/menu-brand";
import type { Order } from "@/types/api";

type OrderTrackingPageProps = {
  params: Promise<{ tenant: string; uuid: string }>;
};

/** Convierte el slug del subdominio en un nombre legible. */
function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: OrderTrackingPageProps): Promise<Metadata> {
  const { tenant, uuid } = await params;
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const name = profile?.name ?? prettifyTenant(tenant);
  return buildTenantPageMetadata({
    title: `${name} · Pedido ${uuid.slice(0, 8)}`,
    description: `Sigue el estado de tu pedido en ${name} en tiempo real.`,
    profile,
  });
}

type OrderLoadResult =
  | { status: "ok"; order: Order }
  | { status: "unavailable"; message: string; canRetry: boolean };

async function loadOrder(
  tenant: string,
  uuid: string,
): Promise<OrderLoadResult> {
  try {
    const order = await getOrderByUuid(uuid, tenant);
    return { status: "ok", order };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return {
        status: "unavailable",
        canRetry: false,
        message:
          "No encontramos este pedido. Verifica el enlace o pregunta al personal.",
      };
    }
    if (error instanceof ApiError && error.isNetworkError) {
      return {
        status: "unavailable",
        canRetry: true,
        message:
          "No pudimos cargar tu pedido. Revisa tu conexión e intenta de nuevo.",
      };
    }
    return {
      status: "unavailable",
      canRetry: true,
      message:
        "No pudimos cargar el seguimiento en este momento. Intenta de nuevo en unos segundos.",
    };
  }
}

/**
 * Tracking del pedido en tiempo real (Módulo Pedidos).
 *
 * Encabezado homologado al menú: colores de marca del perfil (`primaryColor`).
 * Client (`OrderTracker`): STOMP + SockJS, suscrito a `/topic/order/{uuid}`.
 */
export default async function OrderTrackingPage({
  params,
}: OrderTrackingPageProps) {
  const { tenant, uuid } = await params;
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const restaurantName = profile?.name?.trim() || prettifyTenant(tenant);
  const brand = brandFromProfile(profile);
  const hasBrandFill = Boolean(brand.accent);
  const result = await loadOrder(tenant, uuid);

  const supportLine =
    result.status === "ok"
      ? undefined
      : "Seguimiento de pedido";

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[var(--menu-accent-wash,var(--background))] font-jakarta-sans text-foreground"
      style={brand.style}
    >
      {result.status === "ok" ? (
        <OrderTracker
          initialOrder={result.order}
          restaurantName={restaurantName}
          tenantSlug={tenant}
          whatsapp={profile?.whatsapp ?? null}
          logoUrl={profile?.logoUrl ?? null}
          hasBrandFill={hasBrandFill}
        />
      ) : (
        <>
          <CustomerBrandHeader
            restaurantName={restaurantName}
            logoUrl={profile?.logoUrl}
            supportLine={supportLine}
            hasBrandFill={hasBrandFill}
          />
          <div className="flex flex-1 flex-col px-4">
            <OrderUnavailableState
              title="Pedido no disponible"
              description={result.message}
              canRetry={result.canRetry}
              whatsapp={profile?.whatsapp ?? null}
              orderRef={uuid.slice(0, 8)}
            />
          </div>
        </>
      )}
    </main>
  );
}
