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
  { id: "OPEN", label: "Abiertas / En Mesa" },
  { id: "CLOSED", label: "Cerradas / Pagadas" },
  { id: "PICKUP", label: "Para Llevar" },
];

const OPEN_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
]);

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
    return order.tableNumber ? `${code} · Mesa ${order.tableNumber}` : `${code} · En mesa`;
  }
  if (order.orderType === "PICKUP") return `${code} · Para llevar`;
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
  if (order.status === "CLOSED") {
    return {
      label: "CLOSED",
      className:
        "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100",
    };
  }
  if (order.status === "IN_KITCHEN") {
    return {
      label: "IN_KITCHEN",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
    };
  }
  if (order.status === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
    };
  }
  return {
    label: "OPEN",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  };
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
  restaurantName,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
            {restaurantName}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Pedidos / Cuentas
          </h1>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Control de mesas, tickets y cobro. {connectionLabel}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh(filter, pageIndex)}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

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
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                  : "bg-white text-neutral-700 ring-1 ring-black/10 hover:bg-black/[0.03] dark:bg-neutral-900 dark:text-neutral-200 dark:ring-white/10"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {banner ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">
          {banner}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {page.empty ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-neutral-900">
          <Receipt className="mx-auto size-10 text-black/25 dark:text-white/25" />
          <p className="mt-3 text-base font-bold">Sin pedidos en este filtro</p>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            Cuando lleguen comandas aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm md:block dark:border-white/10 dark:bg-neutral-900">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-black/5 bg-neutral-50 text-xs font-bold uppercase tracking-wide text-black/45 dark:border-white/10 dark:bg-neutral-950 dark:text-white/45">
                <tr>
                  <th className="px-4 py-3">Orden</th>
                  <th className="px-4 py-3">Horarios</th>
                  <th className="px-4 py-3">Ítems</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {page.content.map((order) => {
                  const badge = badgeMeta(order);
                  return (
                    <tr
                      key={order.uuid}
                      className="border-b border-black/5 last:border-0 dark:border-white/10"
                    >
                      <td className="px-4 py-4 align-top">
                        <p className="font-extrabold tracking-tight">
                          {orderTitle(order)}
                        </p>
                        <p className="mt-0.5 text-xs text-black/45 dark:text-white/45">
                          {order.customerName}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-black/60 dark:text-white/60">
                        <p>Inicio {formatClock(order.createdAt)}</p>
                        <p className="mt-1">
                          Act. {formatClock(order.updatedAt ?? order.createdAt)}
                        </p>
                      </td>
                      <td className="max-w-xs px-4 py-4 align-top text-xs leading-relaxed text-black/65 dark:text-white/65">
                        {summarizeItems(order)}
                      </td>
                      <td className="px-4 py-4 align-top font-bold">
                        {order.formattedTotal}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailOrder(order)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 py-2 text-xs font-bold dark:bg-white/[0.08]"
                          >
                            <Eye className="size-3.5" aria-hidden />
                            Ver detalle
                          </button>
                          {canClose(order) ? (
                            <button
                              type="button"
                              onClick={() => setCloseTarget(order)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/25"
                            >
                              Cobrar y Cerrar
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
                  className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold tracking-tight">
                        {orderTitle(order)}
                      </p>
                      <p className="mt-0.5 text-xs text-black/45 dark:text-white/45">
                        {order.customerName}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-black/55 dark:text-white/55">
                    Inicio {formatClock(order.createdAt)} · Act.{" "}
                    {formatClock(order.updatedAt ?? order.createdAt)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-black/70 dark:text-white/70">
                    {summarizeItems(order)}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-lg font-black">{order.formattedTotal}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailOrder(order)}
                        className="rounded-xl bg-black/[0.04] px-3 py-2 text-xs font-bold dark:bg-white/[0.08]"
                      >
                        Ver detalle
                      </button>
                      {canClose(order) ? (
                        <button
                          type="button"
                          onClick={() => setCloseTarget(order)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Cobrar y Cerrar
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
          <p className="text-xs text-black/50 dark:text-white/50">
            Página {page.number + 1} de {page.totalPages} · {page.totalElements}{" "}
            pedidos
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page.first || loading}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              className="rounded-xl bg-white px-3 py-2 text-xs font-bold ring-1 ring-black/10 disabled:opacity-40 dark:bg-neutral-900 dark:ring-white/10"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page.last || loading}
              onClick={() => setPageIndex((p) => p + 1)}
              className="rounded-xl bg-white px-3 py-2 text-xs font-bold ring-1 ring-black/10 disabled:opacity-40 dark:bg-neutral-900 dark:ring-white/10"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

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
        confirmLabel={closing ? "Cerrando…" : "Cobrar y Cerrar"}
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
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-extrabold">
              Ticket {orderTitle(order)}
            </h2>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              {formatDateTime(order.createdAt)} ·{" "}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
              >
                {badge.label}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10"
            aria-label="Cerrar detalle"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-black/60 dark:text-white/60">
            Cliente: <span className="font-semibold text-foreground">{order.customerName}</span>
          </p>
          {rounds.length === 0 ? (
            <p className="mt-6 text-sm text-black/50">Sin consumos.</p>
          ) : (
            <div className="mt-4 space-y-5">
              {rounds.map(({ batch, items }) => (
                <section key={batch}>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-black/40 dark:text-white/40">
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
                            <p className="text-xs text-black/45 dark:text-white/45">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 font-bold">
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

        <div className="border-t border-black/5 px-5 py-4 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-black/50 dark:text-white/50">
              Total
            </p>
            <p className="text-xl font-black">
              {formatCurrency(order.totalAmount)}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm font-bold dark:bg-white/[0.08]"
            >
              Cerrar
            </button>
            {canClose(order) ? (
              <button
                type="button"
                onClick={onCloseAccount}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
              >
                Cobrar y Cerrar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
