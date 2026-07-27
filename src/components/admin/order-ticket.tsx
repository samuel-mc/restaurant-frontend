"use client";

/**
 * Tarjeta/comanda del monitor de cocina — agrupada por rondas.
 */

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { Order, OrderItem, OrderItemStatus, OrderStatus } from "@/types/api";
import { maxBatchNumber } from "@/lib/order-mapper";

interface OrderTicketProps {
  order: Order;
  isNew?: boolean;
  isAddition?: boolean;
  isUpdating?: boolean;
  updatingItemId?: number | null;
  errorMessage?: string | null;
  onAdvance: (order: Order) => void;
  onCloseAccount: (order: Order) => void;
  onItemStatus: (order: Order, item: OrderItem, status: OrderItemStatus) => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function formatElapsed(createdAt: string, now: number): string {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return "—";
  const diffSec = Math.max(0, Math.floor((now - start) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function orderTypeLabel(order: Order): string {
  switch (order.orderType) {
    case "IN_TABLE":
      return order.tableNumber ? `Mesa ${order.tableNumber}` : "En mesa";
    case "PICKUP":
      return "Pickup · Para recoger";
    case "DELIVERY":
      return "Delivery";
    default:
      return order.orderType;
  }
}

function nextAction(status: OrderStatus): {
  label: string;
  className: string;
} | null {
  switch (status) {
    case "PENDING":
      return {
        label: "Aceptar pedido",
        className: "bg-amber-500 text-amber-950 hover:bg-amber-400",
      };
    case "ACCEPTED":
      return {
        label: "Empezar a cocinar",
        className: "bg-primary text-primary-foreground hover:bg-primary/90",
      };
    case "IN_KITCHEN":
      return {
        label: "Marcar como listo",
        className: "bg-emerald-600 text-white hover:bg-emerald-500",
      };
    default:
      return null;
  }
}

function closeActionLabel(order: Order): string {
  switch (order.orderType) {
    case "PICKUP":
      return "Cobrar / Entregar";
    case "DELIVERY":
      return "Cobrar / Despachar";
    default:
      return "Cobrar / Cerrar cuenta";
  }
}

function groupByBatch(items: OrderItem[]): Array<{
  batch: number;
  items: OrderItem[];
}> {
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

export function OrderTicket({
  order,
  isNew = false,
  isAddition = false,
  isUpdating = false,
  updatingItemId = null,
  errorMessage = null,
  onAdvance,
  onCloseAccount,
  onItemStatus,
}: OrderTicketProps) {
  const [now, setNow] = useState(() => Date.now());
  const action = nextAction(order.status);
  const latestBatch = maxBatchNumber(order);
  const rounds = useMemo(() => groupByBatch(order.items), [order.items]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = formatElapsed(order.createdAt, now);
  const ageMs = now - new Date(order.createdAt).getTime();
  const urgent = ageMs > 15 * 60 * 1000;

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-background p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-[box-shadow,border-color] duration-200 ${
        order.orderType === "PICKUP"
          ? "border-amber-500/50"
          : isNew || isAddition
            ? "border-amber-500"
            : urgent
              ? "border-destructive"
              : "border-border"
      }`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
            #{order.uuid.slice(0, 8).toUpperCase()}
          </p>
          <h3 className="truncate text-xl font-bold tracking-tight">
            {orderTypeLabel(order)}
          </h3>
          {order.orderType === "PICKUP" ? (
            <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                Cliente · para recoger
              </p>
              <p className="truncate text-base font-bold text-foreground">
                {order.customerName?.trim() || "Sin nombre"}
              </p>
              {order.customerPhone?.trim() ? (
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                  {order.customerPhone.trim()}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sin teléfono
                </p>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">
              {order.customerName}
            </p>
          )}
          {isAddition ? (
            <span className="mt-2 inline-flex rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-amber-950">
              Adición
            </span>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-2xl font-bold tabular-nums leading-none ${
              urgent ? "text-destructive" : "text-foreground"
            }`}
          >
            {elapsed}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            tiempo
          </p>
        </div>
      </header>

      <div className="mb-3 flex-1 space-y-4 border-y border-dashed border-border py-3">
        {rounds.map(({ batch, items }) => {
          const isLatest = batch === latestBatch && latestBatch > 1;
          return (
            <section key={batch}>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground">
                  Ronda {batch}
                </h4>
                {isLatest ? (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                    Adición
                  </span>
                ) : null}
              </div>
              <ul className="space-y-2">
                {items.map((item, index) => {
                  const delivered = item.status === "DELIVERED";
                  const key =
                    item.id ?? `${item.productUuid}-${batch}-${index}`;
                  const itemBusy =
                    updatingItemId != null && item.id === updatingItemId;
                  return (
                    <li
                      key={key}
                      className={`rounded-xl px-3 py-2.5 ${
                        delivered
                          ? "bg-emerald-500/10 opacity-70"
                          : isLatest
                            ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                            : "bg-secondary/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-base leading-snug">
                          <div className="flex items-baseline gap-2">
                            {delivered ? (
                              <Check
                                className="mt-1 size-4 shrink-0 text-emerald-600"
                                aria-hidden
                              />
                            ) : null}
                            <span className="font-bold tabular-nums">
                              {item.quantity}×
                            </span>
                            <span
                              className={`font-semibold ${
                                delivered
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }`}
                            >
                              {item.productName}
                            </span>
                          </div>
                          {item.notes ? (
                            <p className="mt-0.5 pl-7 text-sm font-medium italic text-amber-900 dark:text-amber-300">
                              Obs: {item.notes}
                            </p>
                          ) : null}
                        </div>
                        {item.id != null && !delivered ? (
                          <button
                            type="button"
                            disabled={isUpdating || itemBusy}
                            onClick={() =>
                              onItemStatus(order, item, "DELIVERED")
                            }
                            className={`shrink-0 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${focusRing}`}
                          >
                            {itemBusy ? "…" : "Entregado"}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {order.deliveryAddress ? (
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Dir: {order.deliveryAddress}
        </p>
      ) : null}

      <div className="mb-3 flex items-center justify-between text-base">
        <span className="font-medium text-muted-foreground">Total</span>
        <span className="text-lg font-bold tabular-nums">
          {order.formattedTotal}
        </span>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      {action ? (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onAdvance(order)}
          className={`min-h-12 w-full rounded-xl px-4 py-3 text-base font-bold transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${action.className} ${focusRing}`}
        >
          {isUpdating && updatingItemId == null
            ? "Actualizando…"
            : action.label}
        </button>
      ) : null}

      {order.status === "DELIVERED" || order.orderType === "IN_TABLE" ? (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onCloseAccount(order)}
          className={
            order.status === "DELIVERED"
              ? `min-h-12 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white transition-transform hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${action ? "mt-2" : ""} ${focusRing}`
              : `mt-2 min-h-11 w-full rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary disabled:cursor-wait disabled:opacity-70 ${focusRing}`
          }
        >
          {isUpdating && updatingItemId == null
            ? "Cerrando…"
            : closeActionLabel(order)}
        </button>
      ) : null}
    </article>
  );
}
