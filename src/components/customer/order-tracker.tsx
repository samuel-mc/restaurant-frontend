"use client";

/**
 * Tracking en vivo del pedido del comensal.
 *
 * Recibe el snapshot inicial (REST) y se suscribe a `/topic/order/{uuid}`
 * para reflejar los cambios de cocina sin refrescar.
 */

import { useState } from "react";
import { Check, ChefHat, Clock, UtensilsCrossed, XCircle } from "lucide-react";
import type { Order, OrderStatus } from "@/types/api";
import {
  getStatusDescription,
  getStatusIndex,
  getStatusLabel,
  getStatusTheme,
  TRACKING_STEPS,
} from "@/lib/order-status";
import {
  useOrderStatusSubscription,
  type OrderConnectionState,
} from "@/hooks/useOrderStatusSubscription";

interface OrderTrackerProps {
  initialOrder: Order;
  restaurantName: string;
}

export function OrderTracker({
  initialOrder,
  restaurantName,
}: OrderTrackerProps) {
  const [order, setOrder] = useState(initialOrder);
  const [connection, setConnection] =
    useState<OrderConnectionState>("connecting");

  useOrderStatusSubscription({
    orderUuid: order.uuid,
    enabled: order.status !== "DELIVERED" && order.status !== "CANCELLED",
    onUpdate: setOrder,
    onConnectionChange: setConnection,
  });

  const theme = getStatusTheme(order.status);
  const currentIndex = getStatusIndex(order.status);
  const isCancelled = order.status === "CANCELLED";
  const isDelivered = order.status === "DELIVERED";

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Hero de estado */}
      <section
        className={`-mx-4 bg-linear-to-br px-6 pb-10 pt-10 text-white shadow-sm transition-[background] duration-700 ${theme.hero}`}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-white/80">
          {restaurantName}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Tu pedido
        </h1>
        <p className="mt-1 break-all font-mono text-xs text-white/75">
          #{order.uuid.slice(0, 8)}
        </p>

        <div className="mt-8 flex flex-col items-center text-center">
          <StatusGlyph status={order.status} />
          <p
            key={order.status}
            className="mt-4 animate-[fade-up_0.45s_ease-out] text-2xl font-extrabold tracking-tight"
          >
            {getStatusLabel(order.status)}
          </p>
          <p className="mt-1 max-w-xs text-sm text-white/85">
            {getStatusDescription(order.status)}
          </p>
        </div>

        <ConnectionHint state={connection} terminal={isDelivered || isCancelled} />
      </section>

      {/* Stepper */}
      {!isCancelled ? (
        <ol className="flex items-start justify-between gap-1 px-1" aria-label="Progreso del pedido">
          {TRACKING_STEPS.map((step, index) => {
            const done = index < currentIndex || isDelivered;
            const active = index === currentIndex && !isDelivered;
            const complete = done || (isDelivered && index === currentIndex);

            return (
              <li key={step.status} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-center">
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                        index <= currentIndex || isDelivered
                          ? "bg-emerald-500"
                          : "bg-black/10 dark:bg-white/15"
                      }`}
                    />
                  ) : (
                    <span className="flex-1" />
                  )}
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-500 ${
                      complete
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-100"
                        : active
                          ? `bg-white text-foreground ring-4 ${theme.ring}/30 scale-110 shadow-md`
                          : "bg-black/5 text-black/35 dark:bg-white/10 dark:text-white/35"
                    }`}
                  >
                    {complete ? <Check className="size-4 stroke-[2.5]" /> : index + 1}
                  </span>
                  {index < TRACKING_STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                        index < currentIndex || isDelivered
                          ? "bg-emerald-500"
                          : "bg-black/10 dark:bg-white/15"
                      }`}
                    />
                  ) : (
                    <span className="flex-1" />
                  )}
                </div>
                <span
                  className={`max-w-18 text-center text-[10px] font-semibold leading-tight transition-colors duration-300 ${
                    active || complete
                      ? "text-foreground"
                      : "text-black/35 dark:text-white/35"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {/* Resumen */}
      <section
        aria-label="Resumen del pedido"
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
      >
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Resumen</h2>
            <p className="text-xs text-black/45 dark:text-white/45">
              {order.customerName}
              {order.tableNumber ? ` · Mesa ${order.tableNumber}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors duration-500 ${theme.badge}`}
          >
            {getStatusLabel(order.status)}
          </span>
        </div>

        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {order.items.map((item) => (
            <li
              key={`${item.productUuid}-${item.quantity}`}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="tabular-nums text-black/40 dark:text-white/40">
                    {item.quantity}×
                  </span>{" "}
                  {item.productName}
                </p>
                {item.notes ? (
                  <p className="mt-0.5 text-xs text-black/45 dark:text-white/45">
                    {item.notes}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm tabular-nums text-black/60 dark:text-white/60">
                {item.formattedSubtotal}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/10">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-extrabold tabular-nums">
            {order.formattedTotal}
          </span>
        </div>
      </section>
    </div>
  );
}

function StatusGlyph({ status }: { status: OrderStatus }) {
  const Icon =
    status === "CANCELLED"
      ? XCircle
      : status === "DELIVERED"
        ? Check
        : status === "IN_KITCHEN"
          ? ChefHat
          : status === "ACCEPTED"
            ? UtensilsCrossed
            : Clock;

  return (
    <div
      key={status}
      className="flex size-20 items-center justify-center rounded-3xl bg-white/20 shadow-inner backdrop-blur-sm transition-transform duration-500 animate-[pop_0.4s_ease-out]"
    >
      <Icon className="size-10 stroke-[1.5]" aria-hidden />
    </div>
  );
}

function ConnectionHint({
  state,
  terminal,
}: {
  state: OrderConnectionState;
  terminal: boolean;
}) {
  if (terminal) return null;

  const label =
    state === "connected"
      ? "En vivo · actualizaciones automáticas"
      : state === "connecting"
        ? "Conectando en tiempo real…"
        : "Reconectando…";

  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-white/80">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          state === "connected"
            ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]"
            : "animate-pulse bg-white/70"
        }`}
      />
      {label}
    </p>
  );
}
