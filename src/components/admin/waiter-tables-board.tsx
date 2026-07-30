"use client";

/**
 * Vista del mesero: mesas/cuentas activas + libres, unión de mesas y POS de comanda.
 */

import { useCallback, useMemo, useState } from "react";
import { Link2, Plus, Receipt, RefreshCw } from "lucide-react";
import type { Order, OrderStatus, TableCallResponse } from "@/types/api";
import { AdminConnectionBadge } from "@/components/admin/admin-connection-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MergeTablesModal } from "@/components/admin/merge-tables-modal";
import { TableCallAlerts } from "@/components/admin/table-call-alerts";
import {
  WaiterPosDrawer,
  type WaiterPosLine,
} from "@/components/admin/waiter-pos-drawer";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { useKitchenAlertSound } from "@/hooks/useKitchenAlertSound";
import {
  closeOrder,
  createStaffOrder,
  mergeTables,
} from "@/services/adminOrderService";
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

/** Rango de mesas del piso cuando no hay entidad Table. */
const DEFAULT_FLOOR_SIZE = 24;

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

function normalizeTableKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/^(mesa\s*)/i, "").trim();
}

function linkedBadgeLabel(order: Order): string | null {
  const primary = normalizeTableKey(order.tableNumber);
  const linked = (order.linkedTables ?? [])
    .map(normalizeTableKey)
    .filter(Boolean);
  if (!primary || linked.length === 0) return null;
  const all = [primary, ...linked].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true }),
  );
  return `🔗 Mesa ${all.join("-")} (Unidas)`;
}

function orderTitle(order: Order): string {
  if (order.orderType === "IN_TABLE") {
    const badge = linkedBadgeLabel(order);
    if (badge) return badge;
    return order.tableNumber?.trim()
      ? `Mesa ${normalizeTableKey(order.tableNumber)}`
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

interface PosTarget {
  tableNumber: string;
  activeOrderUuid: string | null;
}

interface WaiterTablesBoardProps {
  tenantSlug: string;
  restaurantName: string;
  initialOrders: Order[];
  floorSize?: number;
}

export function WaiterTablesBoard({
  tenantSlug,
  restaurantName,
  initialOrders,
  floorSize = DEFAULT_FLOOR_SIZE,
}: WaiterTablesBoardProps) {
  const [orders, setOrders] = useState(() =>
    initialOrders.filter((o) => ACTIVE.includes(o.status)),
  );
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [closeTarget, setCloseTarget] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableCalls, setTableCalls] = useState<TableCallResponse[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [posTarget, setPosTarget] = useState<PosTarget | null>(null);
  const playAlertCue = useKitchenAlertSound();

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

  const onTableCall = useCallback(
    (call: TableCallResponse) => {
      setTableCalls((prev) => {
        const without = prev.filter((c) => c.id !== call.id);
        return [call, ...without].slice(0, 12);
      });
      playAlertCue();
    },
    [playAlertCue],
  );

  useKitchenOrdersSubscription({
    tenantSlug,
    onOrderEvent,
    onTableCall,
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

  const occupiedTableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const order of orders) {
      if (order.orderType !== "IN_TABLE") continue;
      const primary = normalizeTableKey(order.tableNumber);
      if (primary) keys.add(primary);
      for (const linked of order.linkedTables ?? []) {
        const t = normalizeTableKey(linked);
        if (t) keys.add(t);
      }
    }
    return keys;
  }, [orders]);

  const freeTables = useMemo(() => {
    const free: string[] = [];
    for (let i = 1; i <= floorSize; i += 1) {
      const key = String(i);
      if (!occupiedTableKeys.has(key)) free.push(key);
    }
    return free;
  }, [floorSize, occupiedTableKeys]);

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

  async function confirmMerge(primary: string, secondaries: string[]) {
    setBusy(true);
    setMergeError(null);
    setError(null);
    try {
      const merged = await mergeTables(
        { primaryTable: primary, secondaryTables: secondaries },
        tenantSlug,
      );
      setOrders((prev) => {
        const absorbed = new Set(secondaries.map(normalizeTableKey));
        const withoutSecondaries = prev.filter((o) => {
          if (o.uuid === merged.uuid) return false;
          const t = normalizeTableKey(o.tableNumber);
          return !t || !absorbed.has(t);
        });
        return [merged, ...withoutSecondaries];
      });
      setMergeOpen(false);
    } catch (err) {
      setMergeError(getAdminErrorMessage(err, "No se pudieron unir las mesas."));
    } finally {
      setBusy(false);
    }
  }

  async function submitPos(lines: WaiterPosLine[]) {
    if (!posTarget) return;
    setBusy(true);
    setError(null);
    try {
      const order = await createStaffOrder(
        {
          tableNumber: posTarget.tableNumber,
          activeOrderUuid: posTarget.activeOrderUuid,
          customerName: `Mesa ${posTarget.tableNumber}`,
          details: lines.map((line) => ({
            productUuid: line.productUuid,
            quantity: line.quantity,
            notes: line.notes,
            modifierUuids: line.modifierUuids,
          })),
        },
        tenantSlug,
      );
      setOrders((prev) => {
        const without = prev.filter((o) => o.uuid !== order.uuid);
        return [order, ...without];
      });
      setPosTarget(null);
    } finally {
      setBusy(false);
    }
  }

  function openPosForOrder(order: Order) {
    const table = normalizeTableKey(order.tableNumber);
    if (!table) {
      setError("Esta cuenta no tiene número de mesa.");
      return;
    }
    setError(null);
    setPosTarget({ tableNumber: table, activeOrderUuid: order.uuid });
  }

  function openPosForFreeTable(table: string) {
    setError(null);
    setPosTarget({ tableNumber: table, activeOrderUuid: null });
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
        <div className="flex flex-wrap items-center gap-2">
          <AdminConnectionBadge state={connection} />
          <span className="inline-flex min-h-11 items-center rounded-full bg-secondary px-3 text-sm font-semibold tabular-nums">
            {sorted.length} activas
          </span>
          <button
            type="button"
            onClick={() => {
              setMergeError(null);
              setMergeOpen(true);
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold ${focusRing}`}
          >
            <Link2 className="size-4" aria-hidden />
            Unir Mesas
          </button>
        </div>
      </header>

      <TableCallAlerts
        calls={tableCalls}
        onDismiss={(id) =>
          setTableCalls((prev) => prev.filter((c) => c.id !== id))
        }
        onDismissAll={() => setTableCalls([])}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Cuentas abiertas
        </h2>
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-lg font-semibold">No hay mesas abiertas</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Toma un pedido en una mesa libre o espera el QR del comensal.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((order) => {
              const badge = statusLabel(order.status);
              const itemCount = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );
              const tableKey = normalizeTableKey(order.tableNumber);
              const merged = linkedBadgeLabel(order);
              const hasCall =
                order.orderType === "IN_TABLE" &&
                Boolean(tableKey) &&
                tableCalls.some(
                  (c) => normalizeTableKey(c.tableNumber) === tableKey,
                );
              return (
                <li
                  key={order.uuid}
                  className={`flex flex-col rounded-2xl border bg-card p-4 ${
                    hasCall
                      ? "border-warn ring-2 ring-warn/40"
                      : merged
                        ? "border-live/50 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                        : "border-border shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold tracking-tight">
                        {orderTitle(order)}
                      </p>
                      {merged ? (
                        <span className="mt-1 inline-flex rounded-full bg-live-muted px-2.5 py-0.5 text-xs font-semibold text-live-ink">
                          Unidas
                        </span>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {itemCount} platillo{itemCount === 1 ? "" : "s"}
                        {order.staffName
                          ? ` · Atendido por: ${order.staffName}`
                          : order.customerName?.trim()
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
                    <button
                      type="button"
                      onClick={() => openPosForOrder(order)}
                      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing}`}
                    >
                      <Plus className="size-4" aria-hidden />
                      Tomar Pedido / Adición
                    </button>
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
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Mesas libres
        </h2>
        {freeTables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todas las mesas del piso tienen cuenta abierta.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {freeTables.map((table) => (
              <li
                key={`free-${table}`}
                className="flex flex-col rounded-2xl border border-dashed border-border bg-card/60 p-3"
              >
                <p className="text-lg font-bold tabular-nums">Mesa {table}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Libre</p>
                <button
                  type="button"
                  onClick={() => openPosForFreeTable(table)}
                  className={`mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-sm font-semibold text-primary-foreground ${focusRing}`}
                >
                  <Plus className="size-4" aria-hidden />
                  Tomar Pedido
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
            ? `¿Cobrar ${orderTitle(closeTarget)} por ${closeTarget.formattedTotal || formatCurrency(closeTarget.totalAmount)}? Las mesas vinculadas quedarán libres.`
            : ""
        }
        confirmLabel="Cobrar"
        busyLabel="Cobrando…"
        tone="neutral"
        busy={busy}
        onConfirm={() => void confirmClose()}
        onCancel={() => !busy && setCloseTarget(null)}
      />

      <MergeTablesModal
        open={mergeOpen}
        occupiedTables={Array.from(occupiedTableKeys)}
        floorSize={floorSize}
        busy={busy}
        error={mergeError}
        onConfirm={(primary, secondaries) => {
          void confirmMerge(primary, secondaries);
        }}
        onCancel={() => !busy && setMergeOpen(false)}
      />

      <WaiterPosDrawer
        open={!!posTarget}
        tenantSlug={tenantSlug}
        tableNumber={posTarget?.tableNumber ?? ""}
        activeOrderUuid={posTarget?.activeOrderUuid}
        busy={busy}
        onClose={() => !busy && setPosTarget(null)}
        onSubmit={submitPos}
      />
    </div>
  );
}
