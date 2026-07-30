"use client";

/**
 * Listado de pedidos/cuentas (auditoría).
 * Filtros + tabla/cards + detalle; WS en vivo. Cobro solo en Cocina.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChefHat, Eye, Receipt, X } from "lucide-react";
import type { AdminOrderListFilter, Order, OrderItem, OrderPage, TableCallResponse } from "@/types/api";
import { AdminConnectionBadge } from "@/components/admin/admin-connection-badge";
import { AdminOptionGroup } from "@/components/admin/admin-option-group";
import { TableCallAlerts } from "@/components/admin/table-call-alerts";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { useKitchenAlertSound } from "@/hooks/useKitchenAlertSound";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { adminKitchenOrderHref } from "@/lib/admin-nav";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { listOrders } from "@/services/adminOrderService";
import { formatCurrency } from "@/lib/format";

const PAGE_SIZE = 20;

const FILTERS: Array<{ id: AdminOrderListFilter; label: string }> = [
  { id: "ALL", label: "Todas" },
  { id: "OPEN", label: "Mesas abiertas" },
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
      ? `${code} · Para llevar · ${who} · ${phone}`
      : `${code} · Para llevar · ${who}`;
  }
  if (order.orderType === "DELIVERY") {
    const who = order.customerName?.trim() || "Cliente";
    const phone = order.customerPhone?.trim();
    return phone
      ? `${code} · A domicilio · ${who} · ${phone}`
      : `${code} · A domicilio · ${who}`;
  }
  return code;
}

function isChannelOrder(order: Order): boolean {
  return order.orderType === "PICKUP" || order.orderType === "DELIVERY";
}

function orderSecondaryLine(order: Order): {
  text: string;
  channel: boolean;
} | null {
  if (isChannelOrder(order)) {
    if (order.orderType === "DELIVERY" && order.deliveryAddress?.trim()) {
      return { text: order.deliveryAddress.trim(), channel: true };
    }
    return null;
  }
  const name = order.customerName?.trim();
  return name ? { text: name, channel: false } : null;
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
        className: "bg-warn-muted text-warn-ink",
      };
    case "ACCEPTED":
      return {
        label: "Aceptado",
        className: "bg-secondary text-foreground ring-1 ring-border",
      };
    case "IN_KITCHEN":
      return {
        label: "En cocina",
        className: "bg-secondary text-foreground ring-1 ring-border",
      };
    case "DELIVERED":
      return {
        label: "Por cobrar",
        className: "bg-live-muted text-live-ink",
      };
    default:
      return {
        label: "Abierta",
        className: "bg-live-muted text-live-ink",
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

function filterEmptyCopy(filter: AdminOrderListFilter): {
  title: string;
  body: string;
} {
  switch (filter) {
    case "OPEN":
      return {
        title: "Sin mesas abiertas",
        body: "Solo cuentas en mesa aún sin cobrar. Para llevar está en su propio filtro.",
      };
    case "PICKUP":
      return {
        title: "Sin pedidos para llevar",
        body: "Cuando lleguen comandas para llevar aparecerán aquí.",
      };
    case "CLOSED":
      return {
        title: "Sin cuentas cerradas",
        body: "Las cuentas cobradas aparecen aquí.",
      };
    case "ALL":
    default:
      return {
        title: "Sin pedidos en este filtro",
        body: "Cuando lleguen comandas aparecerán aquí automáticamente.",
      };
  }
}

function kitchenListAction(order: Order): {
  href: string;
  label: string;
  tone: "live" | "primary";
} | null {
  if (order.status === "CLOSED" || order.status === "CANCELLED") return null;
  if (order.status === "DELIVERED") {
    return {
      href: adminKitchenOrderHref(order.uuid),
      label: "Cobrar en Cocina",
      tone: "live",
    };
  }
  return {
    href: adminKitchenOrderHref(order.uuid),
    label: "Abrir en Cocina",
    tone: "primary",
  };
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
  const detailTitleId = useId();
  const [tableCalls, setTableCalls] = useState<TableCallResponse[]>([]);
  const playAlertCue = useKitchenAlertSound();

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
          getAdminErrorMessage(err, "No se pudieron cargar los pedidos."),
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

  const handleTableCall = useCallback(
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
    onOrderEvent: handleOrderEvent,
    onTableCall: handleTableCall,
    onConnectionChange: setConnection,
  });

  return (
    <div className="font-jakarta-sans">
      <header className="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur-sm md:top-0">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 md:px-6 md:py-2">
          <h1
            className="truncate text-lg font-bold tracking-tight md:text-xl"
            title={restaurantName}
          >
            Pedidos
          </h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <AdminConnectionBadge state={connection} compact />
            <button
              type="button"
              onClick={() => void refresh(filter, pageIndex)}
              disabled={loading}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 md:px-4 ${focusRing}`}
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </div>
        <p className="px-4 pb-2 text-xs text-muted-foreground md:px-6">
          Solo consulta. Avanzar o cobrar en{" "}
          <Link
            href="/admin/dashboard/kitchen"
            className={`font-semibold text-foreground underline-offset-2 hover:underline ${focusRing} rounded-sm`}
          >
            Cocina
          </Link>
          .
        </p>
        {tableCalls.length > 0 ? (
          <div className="border-t border-border px-4 py-3 md:px-6">
            <TableCallAlerts
              calls={tableCalls}
              onDismiss={(id) =>
                setTableCalls((prev) => prev.filter((c) => c.id !== id))
              }
              onDismissAll={() => setTableCalls([])}
            />
          </div>
        ) : null}
      </header>

      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-6"
        aria-busy={loading}
      >
        <AdminOptionGroup
          aria-label="Filtros de pedidos"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-roving-item
                aria-pressed={active}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  setFilter(item.id);
                  setPageIndex(0);
                }}
                className={`min-h-11 rounded-xl px-3.5 text-sm font-semibold transition-colors ${focusRing} ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </AdminOptionGroup>

        {error ? (
          <div
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </div>
        ) : null}

        {page.empty ? (
          <OrdersFilterEmpty filter={filter} />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card lg:block">
              <table className="w-full text-left text-sm">
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
                    const secondary = orderSecondaryLine(order);
                    return (
                      <tr
                        key={order.uuid}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-4 align-top">
                          <p className="font-bold tracking-tight">
                            {orderTitle(order)}
                          </p>
                          {secondary ? (
                            <p
                              className={`mt-0.5 text-xs ${
                                secondary.channel
                                  ? "font-medium text-channel-ink"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {secondary.channel
                                ? `Dir: ${secondary.text}`
                                : secondary.text}
                            </p>
                          ) : null}
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
                          <OrderListActions
                            order={order}
                            onDetail={() => setDetailOrder(order)}
                            layout="row"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-3 lg:hidden">
              {page.content.map((order) => {
                const badge = badgeMeta(order);
                const secondary = orderSecondaryLine(order);
                const channel = isChannelOrder(order);
                return (
                  <li
                    key={order.uuid}
                    className={`rounded-2xl border bg-card p-4 ${
                      channel ? "border-channel/70" : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold tracking-tight">
                          {orderTitle(order)}
                        </p>
                        {secondary ? (
                          <p
                            className={`mt-0.5 text-xs ${
                              secondary.channel
                                ? "font-medium text-channel-ink"
                                : "text-muted-foreground"
                            }`}
                          >
                            {secondary.channel
                              ? `Dir: ${secondary.text}`
                              : secondary.text}
                          </p>
                        ) : null}
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
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                      {summarizeItems(order)}
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <p className="text-lg font-bold tabular-nums">
                        {order.formattedTotal}
                      </p>
                      <OrderListActions
                        order={order}
                        onDetail={() => setDetailOrder(order)}
                        layout="stack"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {!page.empty && page.totalPages > 1 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Página {page.number + 1} de {page.totalPages} ·{" "}
              {page.totalElements} pedidos
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                disabled={page.first || loading}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                className={`min-h-11 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold disabled:opacity-40 ${focusRing}`}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page.last || loading}
                onClick={() => setPageIndex((p) => p + 1)}
                className={`min-h-11 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold disabled:opacity-40 ${focusRing}`}
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
        />
      ) : null}
    </div>
  );
}

function OrderListActions({
  order,
  onDetail,
  layout,
}: {
  order: Order;
  onDetail: () => void;
  layout: "row" | "stack";
}) {
  const kitchen = kitchenListAction(order);
  const stack = layout === "stack";

  return (
    <div
      className={
        stack
          ? "flex w-full flex-col gap-2 sm:w-auto sm:min-w-[12rem]"
          : "flex flex-wrap justify-end gap-2"
      }
    >
      {kitchen ? (
        <Link
          href={kitchen.href}
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-bold ${focusRing} ${
            stack ? "w-full" : ""
          } ${
            kitchen.tone === "live"
              ? "bg-live text-live-foreground hover:brightness-110"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <ChefHat className="size-3.5" aria-hidden />
          {kitchen.label}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onDetail}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-semibold hover:bg-secondary/80 ${focusRing} ${
          stack ? "w-full" : ""
        }`}
      >
        <Eye className="size-3.5" aria-hidden />
        Ver detalle
      </button>
    </div>
  );
}

function OrdersFilterEmpty({ filter }: { filter: AdminOrderListFilter }) {
  const { title, body } = filterEmptyCopy(filter);
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <Receipt
        className="mx-auto size-10 text-muted-foreground"
        aria-hidden
      />
      <p className="mt-3 text-base font-bold tracking-tight">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function OrderDetailModal({
  order,
  titleId,
  onClose,
}: {
  order: Order;
  titleId: string;
  onClose: () => void;
}) {
  const rounds = groupByBatch(order.items);
  const badge = badgeMeta(order);
  const panelRef = useModalFocusTrap({ open: true, onEscape: onClose });

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
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
              {order.customerName || "—"}
            </span>
          </p>
          {order.customerPhone?.trim() ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Tel:{" "}
              <span className="font-semibold text-foreground">
                {order.customerPhone.trim()}
              </span>
            </p>
          ) : null}
          {order.deliveryAddress?.trim() ? (
            <p className="mt-2 text-sm font-medium text-channel-ink">
              Dir: {order.deliveryAddress.trim()}
            </p>
          ) : null}
          {order.status === "DELIVERED" ? (
            <p className="mt-3 rounded-xl border border-live/30 bg-live-muted px-3 py-2.5 text-sm text-live-ink">
              Lista para cobro. Cierra la cuenta en{" "}
              <Link
                href={adminKitchenOrderHref(order.uuid)}
                className={`font-bold underline-offset-2 hover:underline ${focusRing} rounded-sm`}
              >
                Cocina → Por cobrar
              </Link>
              .
            </p>
          ) : order.status !== "CLOSED" && order.status !== "CANCELLED" ? (
            <p className="mt-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-muted-foreground">
              El avance de etapa y el cobro se hacen en{" "}
              <Link
                href={adminKitchenOrderHref(order.uuid)}
                className={`font-semibold text-foreground underline-offset-2 hover:underline ${focusRing} rounded-sm`}
              >
                Cocina
              </Link>
              . Aquí solo revisas el historial.
            </p>
          ) : null}
          {rounds.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Sin consumos.</p>
          ) : (
            <div className="mt-4 space-y-5">
              {rounds.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Cada ronda es un envío distinto del comensal.
                </p>
              ) : null}
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
                          {item.modifiers?.length ? (
                            <p className="text-xs text-muted-foreground">
                              {item.modifiers.map((m) => m.name).join(" · ")}
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
          <button
            type="button"
            onClick={onClose}
            className={`mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold ${focusRing}`}
          >
            Cerrar
          </button>
          {order.status === "DELIVERED" ? (
            <Link
              href={adminKitchenOrderHref(order.uuid)}
              className={`mt-2 flex min-h-11 w-full items-center justify-center rounded-xl bg-live px-4 text-sm font-bold text-live-foreground hover:brightness-110 ${focusRing}`}
            >
              Cobrar en Cocina
            </Link>
          ) : order.status !== "CLOSED" && order.status !== "CANCELLED" ? (
            <Link
              href={adminKitchenOrderHref(order.uuid)}
              className={`mt-2 flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 ${focusRing}`}
            >
              Abrir en Cocina
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
