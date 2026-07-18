"use client";

/**
 * Tarjeta/comanda del monitor de cocina — tipografía grande, alto contraste.
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
      return "Para llevar";
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
        label: "Aceptar Pedido",
        className: "bg-amber-500 text-amber-950 shadow-amber-500/30",
      };
    case "ACCEPTED":
      return {
        label: "Empezar a Cocinar",
        className: "bg-sky-600 text-white shadow-sky-600/30",
      };
    case "IN_KITCHEN":
      return {
        label: "Marcar como Listo",
        className: "bg-emerald-600 text-white shadow-emerald-600/30",
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
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = formatElapsed(order.createdAt, now);
  const ageMs = now - new Date(order.createdAt).getTime();
  const urgent = ageMs > 15 * 60 * 1000;

  return (
    <article
      className={`flex flex-col rounded-3xl bg-white p-5 shadow-md ring-1 transition-all duration-500 dark:bg-neutral-900 ${
        isNew
          ? "ring-4 ring-amber-400 shadow-lg shadow-amber-500/25"
          : urgent
            ? "ring-2 ring-red-500"
            : "ring-black/10 dark:ring-white/10"
      }`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold tracking-wide text-black/50 dark:text-white/50">
            #{order.uuid.slice(0, 8).toUpperCase()}
          </p>
          <h3 className="truncate text-2xl font-black tracking-tight">
            {orderTypeLabel(order)}
          </h3>
          <p className="mt-0.5 text-base font-semibold text-black/60 dark:text-white/60">
            {order.customerName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-3xl font-black tabular-nums leading-none ${
              urgent ? "text-red-600" : "text-foreground"
            }`}
          >
            {elapsed}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
            tiempo
          </p>
        </div>
      </header>

      <ul className="mb-4 flex-1 space-y-2.5 border-y border-dashed border-black/15 py-4 dark:border-white/15">
        {order.items.map((item, index) => (
          <li
            key={`${item.productUuid}-${index}`}
            className="text-lg leading-snug"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-black tabular-nums">{item.quantity}×</span>
              <span className="font-bold">{item.productName}</span>
            </div>
            {item.notes ? (
              <p className="mt-0.5 pl-7 text-sm font-semibold italic text-amber-800 dark:text-amber-300">
                Obs: {item.notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.deliveryAddress ? (
        <p className="mb-3 text-sm font-semibold text-black/55 dark:text-white/55">
          Dir: {order.deliveryAddress}
        </p>
      ) : null}

      <div className="mb-4 flex items-center justify-between text-base">
        <span className="font-semibold text-black/45 dark:text-white/45">
          Total
        </span>
        <span className="text-xl font-black tabular-nums">
          {order.formattedTotal}
        </span>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      {action ? (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onAdvance(order)}
          className={`w-full rounded-2xl px-4 py-4 text-lg font-black shadow-md transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${action.className}`}
        >
          {isUpdating ? "Actualizando…" : action.label}
        </button>
      ) : null}
    </article>
  );
}
