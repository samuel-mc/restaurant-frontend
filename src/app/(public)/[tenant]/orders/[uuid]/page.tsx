import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { getOrderByUuid } from "@/services/orderService";
import { ApiError } from "@/services/apiClient";
import { OrderTracker } from "@/components/customer/order-tracker";
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
  const name = prettifyTenant(tenant);
  return {
    title: `${name} · Pedido ${uuid.slice(0, 8)}`,
    description: `Sigue el estado de tu pedido en ${name} en tiempo real.`,
  };
}

type OrderLoadResult =
  | { status: "ok"; order: Order }
  | { status: "unavailable"; message: string };

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
        message:
          "No encontramos este pedido. Verifica el enlace o pregunta al personal.",
      };
    }
    if (error instanceof ApiError && error.isNetworkError) {
      return {
        status: "unavailable",
        message:
          "No pudimos cargar tu pedido. Revisa tu conexión e intenta de nuevo.",
      };
    }
    return {
      status: "unavailable",
      message:
        "No pudimos cargar el seguimiento en este momento. Intenta de nuevo en unos segundos.",
    };
  }
}

/**
 * Tracking del pedido en tiempo real (Módulo Pedidos).
 *
 * Server Component: `GET /api/v1/orders/{uuid}` pinta el estado inicial (SSR).
 * Client (`OrderTracker`): STOMP + SockJS sobre `NEXT_PUBLIC_WS_URL`,
 * suscrito a `/topic/order/{uuid}` con reconexión automática.
 */
export default async function OrderTrackingPage({
  params,
}: OrderTrackingPageProps) {
  const { tenant, uuid } = await params;
  const restaurantName = prettifyTenant(tenant);
  const result = await loadOrder(tenant, uuid);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-neutral-50 px-4 dark:bg-neutral-950">
      {result.status === "ok" ? (
        <OrderTracker
          initialOrder={result.order}
          restaurantName={restaurantName}
        />
      ) : (
        <OrderUnavailableState
          title="Pedido no disponible"
          description={result.message}
        />
      )}
    </main>
  );
}

function OrderUnavailableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <header className="-mx-4 mb-1 bg-linear-to-br from-amber-500 to-orange-600 px-6 pb-8 pt-10 text-white shadow-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-white/80">
          Seguimiento
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Tu pedido
        </h1>
      </header>
      <section
        aria-live="polite"
        className="my-8 flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
      >
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <ClipboardList className="size-7 stroke-[1.5]" />
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="max-w-xs text-sm leading-relaxed text-black/55 dark:text-white/55">
          {description}
        </p>
      </section>
    </>
  );
}
