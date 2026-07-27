"use client";

/**
 * Listado y control de pedidos/cuentas (caja).
 * Filtros + tabla/cards + detalle + cobro; WS + refetch tras cerrar.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Eye, Receipt, X } from "lucide-react";
import type { AdminOrderListFilter, Order, OrderItem, OrderPage } from "@/types/api";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { closeOrder, listOrders } from "@/services/adminOrderService";
import { ApiError } from "@/services/apiClient";
import { formatCurrency } from "@/lib/format";

const PAGE_SIZE = 20;

const FILTERS: Array<{ id: AdminOrderListFilter; label: string }> = [
  { id: "ALL", label: "Todas" },
  { id: "OPEN", label: "Abiertas" },
  { id: "CLOSED", label: "Cerradas" },
  { id: "PICKUP", label: "Para llevar" },
];

const OPEN_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
]);

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface OrdersBoardProps {
  tenantSlug: string;
  restaurantName: string;
  initialPage: OrderPage;
  initialFilter: AdminOrderListFilter;
}

function orderDisplayCode(order: Order): string {
  if (order.id != null) return String(order.id);
  return order.uuid.slice(0, 8).toUpperCase();
}

function orderTitle(order: Order): string {
  const code = `#${orderDisplayCode(order)}`;
  if (order.orderType === "IN_TABLE") {
    return order.tableNumber
      ? `${code} · Mesa ${order.tableNumber}`
      : `${code} · En mesa`;
  }
  if (order.orderType === "PICKUP") {
    const who = order.customerName?.trim() || "Cliente";
    const phone = order.customerPhone?.trim();
    return phone
      ? `${code} · Pickup · ${who} · ${phone}`
      : `${code} · Pickup · ${who}`;
  }
  if (order.orderType === "DELIVERY") return `${code} · Delivery`;
  return code;
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeMeta(order: Order): { label: string; className: string } {
  switch (order.status) {
    case "CLOSED":
      return {
        label: "Cerrada",
        className: "bg-secondary text-muted-foreground",
      };
    case "CANCELLED":
      return {
        label: "Cancelada",
        className: "bg-destructive/10 text-destructive",
      };
    case "PENDING":
      return {
        label: "Recibido",
        className: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
      };
    case "ACCEPTED":
      return {
        label: "Aceptado",
        className: "bg-secondary text-foreground",
      };
    case "IN_KITCHEN":
      return {
        label: "En cocina",
        className: "bg-amber-500/20 text-amber-950 dark:text-amber-100",
      };
    case "DELIVERED":
      return {
        label: "Por cobrar",
        className: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
      };
    default:
      return {
        label: "Abierta",
        className: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
      };
  }
}

function groupByBatch(items: OrderItem[]): Array<{ batch: number; items: OrderItem[] }> {
  const map = new Map<number, OrderItem[]>();
  for (const item of items) {
    const list = map.get(item.batchNumber) ?? [];
    list.push(item);
    map.set(item.batchNumber, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([batch, batchItems]) => ({ batch, items: batchItems }));
}

function summarizeItems(order: Order): string {
  const rounds = groupByBatch(order.items);
  if (rounds.length === 0) return "Sin ítems";
  return rounds
    .map(({ batch, items }) => {
      const names = items
        .slice(0, 3)
        .map((i) => `${i.quantity}× ${i.productName}`)
        .join(", ");
      const extra = items.length > 3 ? ` +${items.length - 3}` : "";
      return `R${batch}: ${names}${extra}`;
    })
    .join(" · ");
}

function matchesFilter(order: Order, filter: AdminOrderListFilter): boolean {
  switch (filter) {
    case "OPEN":
      return (
        order.orderType === "IN_TABLE" && OPEN_STATUSES.has(order.status)
      );
    case "CLOSED":
      return order.status === "CLOSED";
    case "PICKUP":
      return order.orderType === "PICKUP";
    case "ALL":
    default:
      return true;
  }
}

function canClose(order: Order): boolean {
  return order.status !== "CLOSED" && order.status !== "CANCELLED";
}

export function OrdersBoard({
  tenantSlug,
  initialPage,
  initialFilter,
}: OrdersBoardProps) {
  const [filter, setFilter] = useState<AdminOrderListFilter>(initialFilter);
  const [pageIndex, setPageIndex] = useState(initialPage.number);
  const [page, setPage] = useState<OrderPage>(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [closeTarget, setCloseTarget] = useState<Order | null>(null);
  const [closing, setClosing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const detailTitleId = useId();

  const skipInitialFetch = useRef(true);

  const refresh = useCallback(
    async (nextFilter: AdminOrderListFilter, nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listOrders({
          tenantSlug,
          filter: nextFilter,
          page: nextPage,
          size: PAGE_SIZE,
        });
        setPage(result);
        setPageIndex(result.number);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los pedidos.",
        );
      } finally {
        setLoading(false);
      }
    },
    [tenantSlug],
  );

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    void refresh(filter, pageIndex);
  }, [filter, pageIndex, refresh]);

  const handleOrderEvent = useCallback(
    (incoming: Order) => {
      setPage((prev) => {
        const exists = prev.content.some((o) => o.uuid === incoming.uuid);
        const fits = matchesFilter(incoming, filter);

        if (!fits) {
          if (!exists) return prev;
          const content = prev.content.filter((o) => o.uuid !== incoming.uuid);
          return {
            ...prev,
            content,
            totalElements: Math.max(0, prev.totalElements - 1),
            empty: content.length === 0,
          };
        }

        if (exists) {
          return {
            ...prev,
            content: prev.content.map((o) =>
              o.uuid === incoming.uuid ? incoming : o,
            ),
          };
        }

        if (pageIndex !== 0) return prev;

        const content = [incoming, ...prev.content].slice(0, prev.size || PAGE_SIZE);
        return {
          ...prev,
          content,
          totalElements: prev.totalElements + 1,
          empty: false,
        };
      });

      setDetailOrder((current) =>
        current?.uuid === incoming.uuid ? incoming : current,
      );
    },
    [filter, pageIndex],
  );

  useKitchenOrdersSubscription({
    tenantSlug,
    onOrderEvent: handleOrderEvent,
    onConnectionChange: setConnection,
  });

  async function handleConfirmClose() {
    if (!closeTarget || closing) return;
    setClosing(true);
    setError(null);
    try {
      const updated = await closeOrder(closeTarget.uuid, tenantSlug);
      setBanner(`Cuenta #${orderDisplayCode(updated)} cobrada y cerrada.`);
      setCloseTarget(null);
      setDetailOrder((current) =>
        current?.uuid === updated.uuid ? updated : current,
      );
      await refresh(filter, pageIndex);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo cerrar la cuenta.",
      );
    } finally {
      setClosing(false);
    }
  }

  const connectionLabel = useMemo(() => {
    if (connection === "connected") return "En vivo";
    if (connection === "connecting") return "Conectando…";
    return "Sin conexión";
  }, [connection]);

  return (
    <div className="font-jakarta-sans">
      <header className="border-b border-border px-4 py-5 md:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mesas, tickets y cobro · {connectionLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh(filter, pageIndex)}
            disabled={loading}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 ${focusRing}`}
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-6">
        <div
          role="tablist"
          aria-label="Filtros de pedidos"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(item.id);
                  setPageIndex(0);
                }}
                className={`min-h-10 rounded-xl px-3.5 text-sm font-semibold transition-colors ${focusRing} ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {banner ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-100"
          >
            {banner}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </div>
        ) : null}

        {page.empty ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Receipt
              className="mx-auto size-10 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-base font-bold tracking-tight">
              Sin pedidos en este filtro
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando lleguen comandas aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border bg-secondary/50 text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Orden</th>
                    <th className="px-4 py-3 font-semibold">Horarios</th>
                    <th className="px-4 py-3 font-semibold">Ítems</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.content.map((order) => {
                    const badge = badgeMeta(order);
                    return (
                      <tr
                        key={order.uuid}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-4 align-top">
                          <p className="font-bold tracking-tight">
                            {orderTitle(order)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {order.customerName}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                          <p>Inicio {formatClock(order.createdAt)}</p>
                          <p className="mt-1">
                            Act.{" "}
                            {formatClock(order.updatedAt ?? order.createdAt)}
                          </p>
                        </td>
                        <td className="max-w-xs px-4 py-4 align-top text-xs leading-relaxed text-muted-foreground">
                          {summarizeItems(order)}
                        </td>
                        <td className="px-4 py-4 align-top font-semibold tabular-nums">
                          {order.formattedTotal}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailOrder(order)}
                              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-semibold hover:bg-secondary/80 ${focusRing}`}
                            >
                              <Eye className="size-3.5" aria-hidden />
                              Ver detalle
                            </button>
                            {canClose(order) ? (
                              <button
                                type="button"
                                onClick={() => setCloseTarget(order)}
                                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 ${focusRing}`}
                              >
                                Cobrar y cerrar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {page.content.map((order) => {
                const badge = badgeMeta(order);
                return (
                  <li
                    key={order.uuid}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold tracking-tight">
                          {orderTitle(order)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {order.customerName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Inicio {formatClock(order.createdAt)} · Act.{" "}
                      {formatClock(order.updatedAt ?? order.createdAt)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                      {summarizeItems(order)}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-lg font-bold tabular-nums">
                        {order.formattedTotal}
                      </p>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailOrder(order)}
                          className={`min-h-9 rounded-xl bg-secondary px-3 text-xs font-semibold ${focusRing}`}
                        >
                          Ver detalle
                        </button>
                        {canClose(order) ? (
                          <button
                            type="button"
                            onClick={() => setCloseTarget(order)}
                            className={`min-h-9 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white ${focusRing}`}
                          >
                            Cobrar y cerrar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {!page.empty && page.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Página {page.number + 1} de {page.totalPages} ·{" "}
              {page.totalElements} pedidos
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page.first || loading}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                className={`min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold disabled:opacity-40 ${focusRing}`}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page.last || loading}
                onClick={() => setPageIndex((p) => p + 1)}
                className={`min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold disabled:opacity-40 ${focusRing}`}
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {detailOrder ? (
        <OrderDetailModal
          order={detailOrder}
          titleId={detailTitleId}
          onClose={() => setDetailOrder(null)}
          onCloseAccount={() => {
            setCloseTarget(detailOrder);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(closeTarget)}
        title="¿Cobrar y cerrar cuenta?"
        description={
          closeTarget
            ? `Se marcará ${orderTitle(closeTarget)} como pagada (${closeTarget.formattedTotal}) y se liberará la mesa.`
            : ""
        }
        confirmLabel={closing ? "Cerrando…" : "Cobrar y cerrar"}
        cancelLabel="Cancelar"
        busy={closing}
        tone="neutral"
        onConfirm={() => void handleConfirmClose()}
        onCancel={() => {
          if (!closing) setCloseTarget(null);
        }}
      />
    </div>
  );
}

function OrderDetailModal({
  order,
  titleId,
  onClose,
  onCloseAccount,
}: {
  order: Order;
  titleId: string;
  onClose: () => void;
  onCloseAccount: () => void;
}) {
  const rounds = groupByBatch(order.items);
  const badge = badgeMeta(order);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-card shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-bold tracking-tight">
              Ticket {orderTitle(order)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(order.createdAt)} ·{" "}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary ${focusRing}`}
            aria-label="Cerrar detalle"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Cliente:{" "}
            <span className="font-semibold text-foreground">
              {order.customerName}
            </span>
          </p>
          {rounds.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Sin consumos.</p>
          ) : (
            <div className="mt-4 space-y-5">
              {rounds.map(({ batch, items }) => (
                <section key={batch}>
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    Ronda {batch}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {items.map((item) => (
                      <li
                        key={`${item.id ?? item.productUuid}-${item.batchNumber}-${item.productName}`}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {item.quantity}× {item.productName}
                          </p>
                          {item.notes ? (
                            <p className="text-xs text-muted-foreground">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">
                          {item.formattedSubtotal}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <p className="text-xl font-bold tabular-nums">
              {formatCurrency(order.totalAmount)}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold ${focusRing}`}
            >
              Cerrar
            </button>
            {canClose(order) ? (
              <button
                type="button"
                onClick={onCloseAccount}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 ${focusRing}`}
              >
                Cobrar y cerrar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
