"use client";

/**
 * Monitor en vivo de cocina/caja (Kanban de comandas).
 */

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Order, OrderStatus } from "@/types/api";
import type { AnalyticsSummary } from "@/types/analytics";
import { AnalyticsOverview } from "@/components/admin/analytics-overview";
import { OrderTicket } from "@/components/admin/order-ticket";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { useKitchenAlertSound } from "@/hooks/useKitchenAlertSound";
import { updateOrderStatus } from "@/services/adminOrderService";
import { ApiError } from "@/services/apiClient";

const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "ACCEPTED", "IN_KITCHEN"];

const COLUMNS: Array<{
  status: OrderStatus;
  title: string;
  accent: string;
}> = [
  {
    status: "PENDING",
    title: "Recibidos",
    accent: "border-amber-400 bg-amber-50 dark:bg-amber-500/10",
  },
  {
    status: "ACCEPTED",
    title: "Aceptados",
    accent: "border-sky-400 bg-sky-50 dark:bg-sky-500/10",
  },
  {
    status: "IN_KITCHEN",
    title: "En cocina",
    accent: "border-orange-400 bg-orange-50 dark:bg-orange-500/10",
  },
];

interface KitchenDashboardProps {
  tenantSlug: string;
  restaurantName: string;
  initialOrders: Order[];
  analytics: AnalyticsSummary;
}

function nextStatusFor(status: OrderStatus): OrderStatus | null {
  if (status === "PENDING") return "ACCEPTED";
  if (status === "ACCEPTED") return "IN_KITCHEN";
  // Backend no tiene READY: "Listo" → DELIVERED (sale del tablero activo).
  if (status === "IN_KITCHEN") return "DELIVERED";
  return null;
}

function sortByCreatedAt(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function KitchenDashboard({
  tenantSlug,
  restaurantName,
  initialOrders,
  analytics,
}: KitchenDashboardProps) {
  const [orders, setOrders] = useState<Order[]>(() =>
    sortByCreatedAt(initialOrders),
  );
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [flashUuid, setFlashUuid] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [updatingUuid, setUpdatingUuid] = useState<string | null>(null);
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
  const knownUuidsRef = useRef(new Set(initialOrders.map((o) => o.uuid)));
  const playNewOrderCue = useKitchenAlertSound();

  const handleOrderEvent = useCallback(
    (incoming: Order) => {
      const isActive = ACTIVE_STATUSES.includes(incoming.status);
      const isNew = !knownUuidsRef.current.has(incoming.uuid);

      setOrders((prev) => {
        const without = prev.filter((o) => o.uuid !== incoming.uuid);
        if (!isActive) return without;
        return isNew
          ? [incoming, ...without]
          : sortByCreatedAt([...without, incoming]);
      });

      if (isNew && isActive) {
        knownUuidsRef.current.add(incoming.uuid);
        setFlashUuid(incoming.uuid);
        setBanner(`Nueva comanda · #${incoming.uuid.slice(0, 8).toUpperCase()}`);
        playNewOrderCue();
        window.setTimeout(() => {
          setFlashUuid((current) =>
            current === incoming.uuid ? null : current,
          );
          setBanner((current) =>
            current?.includes(incoming.uuid.slice(0, 8).toUpperCase())
              ? null
              : current,
          );
        }, 4_000);
      } else if (isActive) {
        knownUuidsRef.current.add(incoming.uuid);
      } else {
        knownUuidsRef.current.delete(incoming.uuid);
      }
    },
    [playNewOrderCue],
  );

  useKitchenOrdersSubscription({
    tenantSlug,
    onOrderEvent: handleOrderEvent,
    onConnectionChange: setConnection,
  });

  async function handleAdvance(order: Order) {
    const next = nextStatusFor(order.status);
    if (!next || updatingUuid) return;

    setUpdatingUuid(order.uuid);
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[order.uuid];
      return copy;
    });

    // Mutación optimista: la cocina ve el cambio al instante.
    const optimistic: Order = { ...order, status: next };
    handleOrderEvent(optimistic);

    try {
      const updated = await updateOrderStatus(order.uuid, next, tenantSlug);
      handleOrderEvent(updated);
    } catch (error) {
      handleOrderEvent(order);
      const message =
        error instanceof ApiError
          ? error.message
          : "No se pudo actualizar la comanda.";
      setTicketErrors((prev) => ({ ...prev, [order.uuid]: message }));
    } finally {
      setUpdatingUuid(null);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      PENDING: [],
      ACCEPTED: [],
      IN_KITCHEN: [],
      DELIVERED: [],
      CANCELLED: [],
    };
    for (const order of orders) {
      map[order.status]?.push(order);
    }
    return map;
  }, [orders]);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur md:px-6 dark:border-white/10 dark:bg-neutral-900/95">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-black/45 dark:text-white/45">
              Analíticas · Cocina
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              {restaurantName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <ConnectionBadge state={connection} />
            <span className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-black tabular-nums dark:bg-white/10">
              {orders.length} activas
            </span>
            <Link
              href="/admin/dashboard/menu"
              className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-bold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              Menú
            </Link>
          </div>
        </div>
        {banner ? (
          <p
            role="status"
            className="mx-auto mt-3 max-w-7xl rounded-2xl bg-amber-400 px-4 py-3 text-center text-base font-black text-amber-950 animate-pulse"
          >
            {banner}
          </p>
        ) : null}
      </header>

      <AnalyticsOverview summary={analytics} />

      <div className="mx-auto mt-2 w-full max-w-7xl px-4 md:px-6">
        <div className="flex items-end justify-between gap-3 border-t border-black/5 pt-5 dark:border-white/10">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-black/45 dark:text-white/45">
              Operación
            </p>
            <h2 className="text-xl font-black tracking-tight md:text-2xl">
              Monitor de cocina
            </h2>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3 md:gap-5 md:p-6">
        {COLUMNS.map((column) => {
          const columnOrders = grouped[column.status] ?? [];
          return (
            <section
              key={column.status}
              aria-label={column.title}
              className={`flex min-h-72 flex-col rounded-3xl border-2 border-dashed p-3 md:p-4 ${column.accent}`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-base font-black uppercase tracking-wide">
                  {column.title}
                </h2>
                <span className="rounded-full bg-white/90 px-3 py-1 text-base font-black tabular-nums dark:bg-black/30">
                  {columnOrders.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                {columnOrders.length === 0 ? (
                  <p className="rounded-2xl bg-white/60 px-3 py-10 text-center text-base font-semibold text-black/40 dark:bg-black/20 dark:text-white/40">
                    Sin comandas
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <OrderTicket
                      key={order.uuid}
                      order={order}
                      isNew={flashUuid === order.uuid}
                      isUpdating={updatingUuid === order.uuid}
                      errorMessage={ticketErrors[order.uuid] ?? null}
                      onAdvance={handleAdvance}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionBadge({ state }: { state: KitchenConnectionState }) {
  const label =
    state === "connected"
      ? "En vivo"
      : state === "connecting"
        ? "Conectando…"
        : "Reconectando…";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
        state === "connected"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
      }`}
    >
      <span
        aria-hidden
        className={`size-2.5 rounded-full ${
          state === "connected"
            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
            : "animate-pulse bg-amber-500"
        }`}
      />
      {label}
    </span>
  );
}
