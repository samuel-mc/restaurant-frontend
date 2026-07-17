"use client";

/**
 * Tarjeta/comanda individual del monitor de cocina.
 */

import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/types/api";

interface OrderTicketProps {
  order: Order;
  isNew?: boolean;
  isUpdating?: boolean;
  errorMessage?: string | null;
  onAdvance: (order: Order) => void;
}

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
      return "Pickup";
    case "DELIVERY":
      return "Delivery";
    default:
      return order.orderType;
  }
}

function nextAction(status: OrderStatus): {
  nextStatus: OrderStatus;
  label: string;
  className: string;
} | null {
  switch (status) {
    case "PENDING":
      return {
        nextStatus: "ACCEPTED",
        label: "Aceptar Pedido",
        className: "bg-amber-500 text-white shadow-amber-500/25",
      };
    case "ACCEPTED":
      return {
        nextStatus: "IN_KITCHEN",
        label: "Empezar a Cocinar",
        className: "bg-sky-600 text-white shadow-sky-600/25",
      };
    case "IN_KITCHEN":
      return {
        nextStatus: "DELIVERED",
        label: "Marcar como Listo",
        className: "bg-emerald-600 text-white shadow-emerald-600/25",
      };
    default:
      return null;
  }
}

export function OrderTicket({
  order,
  isNew = false,
  isUpdating = false,
  errorMessage = null,
  onAdvance,
}: OrderTicketProps) {
  const [now, setNow] = useState(() => Date.now());
  const action = nextAction(order.status);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = formatElapsed(order.createdAt, now);
  const urgent =
    Date.now() - new Date(order.createdAt).getTime() > 15 * 60 * 1000;

  return (
    <article
      className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 transition-all duration-500 dark:bg-neutral-900 ${
        isNew
          ? "ring-4 ring-amber-400 shadow-lg shadow-amber-500/20"
          : urgent
            ? "ring-2 ring-red-400/70"
            : "ring-black/10 dark:ring-white/10"
      }`}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-black/45 dark:text-white/45">
            #{order.uuid.slice(0, 8)}
          </p>
          <h3 className="truncate text-lg font-extrabold tracking-tight">
            {orderTypeLabel(order)}
          </h3>
          <p className="text-sm text-black/55 dark:text-white/55">
            {order.customerName}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-2xl font-black tabular-nums leading-none ${
              urgent ? "text-red-600" : "text-foreground"
            }`}
          >
            {elapsed}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            transcurrido
          </p>
        </div>
      </header>

      <ul className="mb-4 flex-1 space-y-1.5 border-y border-dashed border-black/10 py-3 dark:border-white/15">
        {order.items.map((item) => (
          <li
            key={`${item.productUuid}-${item.quantity}`}
            className="flex items-baseline gap-2 text-base leading-snug"
          >
            <span className="font-black tabular-nums">{item.quantity}×</span>
            <span className="font-semibold">{item.productName}</span>
          </li>
        ))}
      </ul>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-black/45 dark:text-white/45">Total</span>
        <span className="font-bold tabular-nums">{order.formattedTotal}</span>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mb-2 rounded-lg bg-red-500/10 px-2.5 py-2 text-xs text-red-700 dark:text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      {action ? (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onAdvance(order)}
          className={`w-full rounded-xl px-4 py-3.5 text-base font-bold shadow-md transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${action.className}`}
        >
          {isUpdating ? "Actualizando..." : action.label}
        </button>
      ) : null}
    </article>
  );
}
