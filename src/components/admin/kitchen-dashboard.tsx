"use client";

/**
 * Monitor en vivo de cocina/caja (Kanban de comandas).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { Order, OrderItem, OrderItemStatus, OrderStatus } from "@/types/api";
import { OrderTicket } from "@/components/admin/order-ticket";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { useKitchenAlertSound } from "@/hooks/useKitchenAlertSound";
import {
  closeOrder,
  updateOrderItemStatus,
  updateOrderStatus,
} from "@/services/adminOrderService";
import { ApiError } from "@/services/apiClient";
import { maxBatchNumber } from "@/lib/order-mapper";

const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
];

const COLUMNS: Array<{
  status: OrderStatus;
  title: string;
  chip: string;
}> = [
  {
    status: "PENDING",
    title: "Recibidos",
    chip: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  {
    status: "ACCEPTED",
    title: "Aceptados",
    chip: "bg-secondary text-foreground",
  },
  {
    status: "IN_KITCHEN",
    title: "En cocina",
    chip: "bg-amber-500/20 text-amber-950 dark:text-amber-100",
  },
  {
    status: "DELIVERED",
    title: "Por cobrar",
    chip: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
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
  initialOrders,
}: KitchenDashboardProps) {
  const [orders, setOrders] = useState<Order[]>(() =>
    sortByCreatedAt(initialOrders),
  );
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [flashUuid, setFlashUuid] = useState<string | null>(null);
  const [additionUuid, setAdditionUuid] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [updatingUuid, setUpdatingUuid] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
  const knownUuidsRef = useRef(new Set(initialOrders.map((o) => o.uuid)));
  const batchByUuidRef = useRef(
    new Map(initialOrders.map((o) => [o.uuid, maxBatchNumber(o)])),
  );
  const playNewOrderCue = useKitchenAlertSound();

  const handleOrderEvent = useCallback(
    (incoming: Order) => {
      const isActive = ACTIVE_STATUSES.includes(incoming.status);
      const isNew = !knownUuidsRef.current.has(incoming.uuid);
      const prevBatch = batchByUuidRef.current.get(incoming.uuid) ?? 0;
      const nextBatch = maxBatchNumber(incoming);
      const isAddition = !isNew && nextBatch > prevBatch;

      setOrders((prev) => {
        const without = prev.filter((o) => o.uuid !== incoming.uuid);
        if (!isActive) return without;
        return isNew
          ? [incoming, ...without]
          : sortByCreatedAt([...without, incoming]);
      });

      batchByUuidRef.current.set(incoming.uuid, nextBatch);

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
      } else if (isAddition && isActive) {
        knownUuidsRef.current.add(incoming.uuid);
        setAdditionUuid(incoming.uuid);
        setBanner(
          `Adición · Mesa ${incoming.tableNumber ?? "—"} · Ronda ${nextBatch}`,
        );
        playNewOrderCue();
        window.setTimeout(() => {
          setAdditionUuid((current) =>
            current === incoming.uuid ? null : current,
          );
          setBanner((current) =>
            current?.includes(`Ronda ${nextBatch}`) ? null : current,
          );
        }, 5_000);
      } else if (isActive) {
        knownUuidsRef.current.add(incoming.uuid);
      } else {
        knownUuidsRef.current.delete(incoming.uuid);
        batchByUuidRef.current.delete(incoming.uuid);
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

  async function handleItemStatus(
    order: Order,
    item: OrderItem,
    status: OrderItemStatus,
  ) {
    if (item.id == null || updatingUuid) return;
    setUpdatingUuid(order.uuid);
    setUpdatingItemId(item.id);
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[order.uuid];
      return copy;
    });

    const optimistic: Order = {
      ...order,
      items: order.items.map((line) =>
        line.id === item.id ? { ...line, status } : line,
      ),
    };
    handleOrderEvent(optimistic);

    try {
      const updated = await updateOrderItemStatus(
        order.uuid,
        item.id,
        status,
        tenantSlug,
      );
      handleOrderEvent(updated);
    } catch (error) {
      handleOrderEvent(order);
      const message =
        error instanceof ApiError
          ? error.message
          : "No se pudo actualizar el platillo.";
      setTicketErrors((prev) => ({ ...prev, [order.uuid]: message }));
    } finally {
      setUpdatingUuid(null);
      setUpdatingItemId(null);
    }
  }

  async function handleCloseAccount(order: Order) {
    if (updatingUuid) return;
    setUpdatingUuid(order.uuid);
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[order.uuid];
      return copy;
    });

    try {
      const updated = await closeOrder(order.uuid, tenantSlug);
      handleOrderEvent(updated);
      const who =
        order.orderType === "IN_TABLE"
          ? `Mesa ${order.tableNumber ?? "—"}`
          : order.orderType === "PICKUP"
            ? order.customerName?.trim() || "Pickup"
            : "Delivery";
      setBanner(
        `Cuenta cerrada · ${who} · #${order.uuid.slice(0, 8).toUpperCase()}`,
      );
      window.setTimeout(() => setBanner(null), 3_500);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "No se pudo cerrar la cuenta.";
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
      CLOSED: [],
      CANCELLED: [],
    };
    for (const order of orders) {
      map[order.status]?.push(order);
    }
    return map;
  }, [orders]);

  return (
    <div className="flex flex-col pb-8 font-jakarta-sans">
      <header className="border-b border-border px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Cocina</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comandas activas en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <ConnectionBadge state={connection} />
            <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold tabular-nums">
              {orders.length} activas
            </span>
          </div>
        </div>
        {banner ? (
          <p
            role="status"
            className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-center text-sm font-semibold text-amber-950 dark:text-amber-100"
          >
            {banner}
          </p>
        ) : null}
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 md:gap-5 md:p-6 lg:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnOrders = grouped[column.status] ?? [];
          return (
            <section
              key={column.status}
              aria-label={column.title}
              className="flex min-h-72 flex-col rounded-2xl border border-border bg-card p-3 md:p-4"
            >
              <header className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 className="text-sm font-bold tracking-tight">
                  {column.title}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${column.chip}`}
                >
                  {columnOrders.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                {columnOrders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-secondary/40 px-3 py-10 text-center text-sm text-muted-foreground">
                    Sin comandas
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <OrderTicket
                      key={order.uuid}
                      order={order}
                      isNew={flashUuid === order.uuid}
                      isAddition={additionUuid === order.uuid}
                      isUpdating={updatingUuid === order.uuid}
                      updatingItemId={
                        updatingUuid === order.uuid ? updatingItemId : null
                      }
                      errorMessage={ticketErrors[order.uuid] ?? null}
                      onAdvance={handleAdvance}
                      onCloseAccount={handleCloseAccount}
                      onItemStatus={handleItemStatus}
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
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
        state === "connected"
          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-900 dark:text-amber-200"
      }`}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${
          state === "connected"
            ? "bg-emerald-500"
            : "animate-pulse bg-amber-500"
        }`}
      />
      {label}
    </span>
  );
}
