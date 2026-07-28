"use client";

/**
 * Vista base del mesero: mesas/cuentas activas con total y acciones rápidas.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Receipt, RefreshCw } from "lucide-react";
import type { Order, OrderStatus } from "@/types/api";
import { AdminConnectionBadge } from "@/components/admin/admin-connection-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { closeOrder } from "@/services/adminOrderService";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { formatCurrency } from "@/lib/format";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const ACTIVE: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
];

function statusLabel(status: OrderStatus): { label: string; className: string } {
  switch (status) {
    case "PENDING":
      return { label: "Pendiente", className: "bg-warn-muted text-warn-ink" };
    case "ACCEPTED":
      return {
        label: "Aceptado",
        className: "bg-secondary text-foreground ring-1 ring-border",
      };
    case "IN_KITCHEN":
      return {
        label: "En cocina",
        className: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
      };
    case "DELIVERED":
      return { label: "Listo / por cobrar", className: "bg-live-muted text-live-ink" };
    default:
      return { label: status, className: "bg-secondary text-muted-foreground" };
  }
}

function orderTitle(order: Order): string {
  if (order.orderType === "IN_TABLE") {
    return order.tableNumber?.trim()
      ? `Mesa ${order.tableNumber.trim()}`
      : "Mesa sin número";
  }
  if (order.orderType === "PICKUP") {
    return order.customerName?.trim() || "Para llevar";
  }
  if (order.orderType === "DELIVERY") {
    return order.customerName?.trim() || "A domicilio";
  }
  return `#${order.uuid.slice(0, 8).toUpperCase()}`;
}

function additionHref(order: Order): string {
  if (order.orderType === "IN_TABLE" && order.tableNumber?.trim()) {
    return `/menu?m=${encodeURIComponent(order.tableNumber.trim())}`;
  }
  return `/admin/dashboard/kitchen?order=${encodeURIComponent(order.uuid)}`;
}

interface WaiterTablesBoardProps {
  tenantSlug: string;
  restaurantName: string;
  initialOrders: Order[];
}

export function WaiterTablesBoard({
  tenantSlug,
  restaurantName,
  initialOrders,
}: WaiterTablesBoardProps) {
  const [orders, setOrders] = useState(() =>
    initialOrders.filter((o) => ACTIVE.includes(o.status)),
  );
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [closeTarget, setCloseTarget] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOrderEvent = useCallback((order: Order) => {
    setOrders((prev) => {
      const without = prev.filter((o) => o.uuid !== order.uuid);
      if (!ACTIVE.includes(order.status)) return without;
      return [order, ...without].sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime(),
      );
    });
  }, []);

  useKitchenOrdersSubscription({
    tenantSlug,
    onOrderEvent: onOrderEvent,
    onConnectionChange: setConnection,
  });

  const sorted = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const aTable = a.tableNumber ?? "";
        const bTable = b.tableNumber ?? "";
        if (aTable && bTable) {
          return aTable.localeCompare(bTable, "es", { numeric: true });
        }
        return (
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime()
        );
      }),
    [orders],
  );

  async function confirmClose() {
    if (!closeTarget || busy) return;
    setBusy(true);
    setError(null);
    try {
      const closed = await closeOrder(closeTarget.uuid, tenantSlug);
      setOrders((prev) => prev.filter((o) => o.uuid !== closed.uuid));
      setCloseTarget(null);
    } catch (err) {
      setError(getAdminErrorMessage(err, "No se pudo cobrar la cuenta."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Gestión de Mesas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {restaurantName} · cuentas abiertas del turno
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminConnectionBadge state={connection} />
          <span className="inline-flex min-h-11 items-center rounded-full bg-secondary px-3 text-sm font-semibold tabular-nums">
            {sorted.length} activas
          </span>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-lg font-semibold">No hay mesas abiertas</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando un comensal ordene, la cuenta aparecerá aquí en vivo.
          </p>
          <Link
            href="/menu"
            className={`mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground ${focusRing}`}
          >
            <Plus className="size-4" aria-hidden />
            Ir al menú
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((order) => {
            const badge = statusLabel(order.status);
            const itemCount = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            return (
              <li
                key={order.uuid}
                className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold tracking-tight">
                      {orderTitle(order)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {itemCount} platillo{itemCount === 1 ? "" : "s"}
                      {order.customerName?.trim()
                        ? ` · ${order.customerName.trim()}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <p className="mt-5 text-3xl font-bold tabular-nums tracking-tight">
                  {order.formattedTotal || formatCurrency(order.totalAmount)}
                </p>

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link
                    href={additionHref(order)}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing}`}
                  >
                    <Plus className="size-4" aria-hidden />
                    Nueva adición
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setCloseTarget(order);
                    }}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-live px-3 text-sm font-bold text-live-foreground ${focusRing}`}
                  >
                    <Receipt className="size-4" aria-hidden />
                    Cobrar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground ${focusRing}`}
        >
          <RefreshCw className="size-4" aria-hidden />
          Actualizar
        </button>
      </div>

      <ConfirmDialog
        open={!!closeTarget}
        title="Cobrar y cerrar cuenta"
        description={
          closeTarget
            ? `¿Cobrar ${orderTitle(closeTarget)} por ${closeTarget.formattedTotal || formatCurrency(closeTarget.totalAmount)}? La mesa quedará libre.`
            : ""
        }
        confirmLabel="Cobrar"
        busyLabel="Cobrando…"
        tone="neutral"
        busy={busy}
        onConfirm={() => void confirmClose()}
        onCancel={() => !busy && setCloseTarget(null)}
      />
    </div>
  );
}
