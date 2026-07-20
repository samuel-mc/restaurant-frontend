"use client";

/**
 * Monitor en vivo de cocina/caja (Kanban de comandas).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { Order, OrderStatus } from "@/types/api";
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
}

function nextStatusFor(status: OrderStatus): OrderStatus | null {
  if (status === "PENDING") return "ACCEPTED";
  if (status === "ACCEPTED") return "IN_KITCHEN";
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
    <div className="flex flex-col pb-6">
      <header className="border-b border-black/5 px-4 py-5 md:px-6 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-black/45 dark:text-white/45">
              Operación
            </p>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
              Monitor de cocina
            </h1>
            <p className="mt-1 text-sm font-medium text-black/50 dark:text-white/50">
              {restaurantName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <ConnectionBadge state={connection} />
            <span className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-black tabular-nums dark:bg-white/10">
              {orders.length} activas
            </span>
          </div>
        </div>
        {banner ? (
          <p
            role="status"
            className="mt-3 rounded-2xl bg-amber-400 px-4 py-3 text-center text-base font-black text-amber-950 animate-pulse"
          >
            {banner}
          </p>
        ) : null}
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3 md:gap-5 md:p-6">
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
