"use client";

/**
 * Tracking en vivo del pedido del comensal.
 *
 * Snapshot inicial (SSR/REST) + suscripción STOMP/SockJS a `/topic/order/{uuid}`.
 * Stepper: Recibido → En Cocina → En preparación → Entregado.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChefHat, Clock, Sparkles, XCircle } from "lucide-react";
import type { Order, OrderItem, OrderStatus } from "@/types/api";
import {
  getStatusDescription,
  getStatusIndex,
  getStatusLabel,
  getStatusTheme,
  toTrackingStepKey,
  TRACKING_STEPS,
} from "@/lib/order-status";
import { maxBatchNumber } from "@/lib/order-mapper";
import { useCartStore } from "@/store/cartStore";
import {
  useOrderStatusSubscription,
  type OrderConnectionState,
} from "@/hooks/useOrderStatusSubscription";

interface OrderTrackerProps {
  initialOrder: Order;
  restaurantName: string;
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

export function OrderTracker({
  initialOrder,
  restaurantName,
}: OrderTrackerProps) {
  const [order, setOrder] = useState(initialOrder);
  const [connection, setConnection] =
    useState<OrderConnectionState>("connecting");
  const clearActiveOrderSession = useCartStore(
    (state) => state.clearActiveOrderSession,
  );
  const setActiveOrderSession = useCartStore(
    (state) => state.setActiveOrderSession,
  );

  const isTerminal =
    order.status === "DELIVERED" ||
    order.status === "CLOSED" ||
    order.status === "CANCELLED";

  useEffect(() => {
    if (isTerminal) {
      clearActiveOrderSession();
      return;
    }
    if (order.orderType === "IN_TABLE" && order.tableNumber) {
      setActiveOrderSession({
        activeOrderId: order.uuid,
        tableNumber: order.tableNumber,
        customerName: order.customerName,
      });
    }
  }, [
    clearActiveOrderSession,
    isTerminal,
    order.customerName,
    order.orderType,
    order.tableNumber,
    order.uuid,
    setActiveOrderSession,
  ]);

  useOrderStatusSubscription({
    orderUuid: order.uuid,
    enabled: !isTerminal,
    onUpdate: setOrder,
    onConnectionChange: setConnection,
  });

  const theme = getStatusTheme(order.status);
  const currentIndex = getStatusIndex(order.status);
  const stepKey = toTrackingStepKey(order.status);
  const isCancelled = order.status === "CANCELLED";
  const isDelivered = order.status === "DELIVERED";
  const isCooking = stepKey === "READY";
  const isAccepted = stepKey === "IN_PREPARATION";
  const latestBatch = maxBatchNumber(order);
  const rounds = useMemo(() => groupByBatch(order.items), [order.items]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <section
        aria-live="polite"
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
          {order.tableNumber ? ` · Mesa ${order.tableNumber}` : ""}
        </p>

        <div className="mt-8 flex flex-col items-center text-center">
          <StatusGlyph status={order.status} highlight={isDelivered} />
          <p
            key={order.status}
            className="mt-4 animate-[fade-up_0.45s_ease-out] text-2xl font-extrabold tracking-tight"
          >
            {getStatusLabel(order.status)}
          </p>
          <p className="mt-1 max-w-xs text-sm text-white/85">
            {getStatusDescription(order.status)}
          </p>

          {isAccepted ? (
            <span className="mt-4 rounded-full bg-yellow-300/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-yellow-950">
              Pedido aceptado
            </span>
          ) : null}
          {isCooking ? (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-800 shadow-sm animate-pulse">
              <ChefHat className="size-3.5 stroke-[2.5]" aria-hidden />
              En preparación
            </span>
          ) : null}
          {isDelivered ? (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm">
              <Check className="size-3.5 stroke-[2.5]" aria-hidden />
              Entregado
            </span>
          ) : null}
        </div>

        <ConnectionHint state={connection} terminal={isTerminal} />
      </section>

      {!isCancelled ? (
        <ol
          className="flex items-start justify-between gap-1 px-1"
          aria-label="Progreso del pedido"
        >
          {TRACKING_STEPS.map((step, index) => {
            const complete = index < currentIndex || isDelivered;
            const active = index === currentIndex && !isDelivered;
            const showCheck =
              complete || (active && step.key === "DELIVERED");

            return (
              <li
                key={step.key}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="flex w-full items-center">
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                        index <= currentIndex
                          ? "bg-emerald-500"
                          : "bg-black/10 dark:bg-white/15"
                      }`}
                    />
                  ) : (
                    <span className="flex-1" />
                  )}
                  <StepDot
                    index={index}
                    active={active}
                    showCheck={showCheck}
                    preparing={active && step.key === "READY"}
                    ringClass={theme.ring}
                  />
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

      <section
        aria-label="Resumen del pedido"
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
      >
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Cuenta de la mesa</h2>
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

        <div className="space-y-5">
          {rounds.map(({ batch, items }) => {
            const isLatest = batch === latestBatch && latestBatch > 1;
            return (
              <div key={batch}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black/45 dark:text-white/45">
                    Ronda {batch}
                  </h3>
                  {isLatest ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
                      Adición reciente
                    </span>
                  ) : null}
                </div>
                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {items.map((item, index) => {
                    const delivered = item.status === "DELIVERED";
                    return (
                      <li
                        key={item.id ?? `${item.productUuid}-${batch}-${index}`}
                        className={`flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 ${
                          delivered ? "opacity-60" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              delivered ? "line-through" : ""
                            }`}
                          >
                            <span className="tabular-nums text-black/40 dark:text-white/40">
                              {item.quantity}×
                            </span>{" "}
                            {item.productName}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
                            {delivered
                              ? "Servido"
                              : item.status === "PREPARING"
                                ? "En cocina"
                                : isLatest
                                  ? "Pedido ahora"
                                  : "Pendiente"}
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
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/10">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-extrabold tabular-nums">
            {order.formattedTotal}
          </span>
        </div>

        {!isTerminal && order.orderType === "IN_TABLE" ? (
          <p className="mt-3 text-center text-xs text-black/45 dark:text-white/45">
            ¿Quieres pedir más? Vuelve al menú y usa{" "}
            <span className="font-semibold">Enviar Adición a la Cocina</span>.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function StepDot({
  index,
  active,
  showCheck,
  preparing,
  ringClass,
}: {
  index: number;
  active: boolean;
  showCheck: boolean;
  preparing: boolean;
  ringClass: string;
}) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-500 ${
        showCheck
          ? "scale-100 bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
          : active
            ? `scale-110 bg-white text-foreground shadow-md ring-4 ${ringClass}/30 ${
                preparing ? "animate-pulse" : ""
              }`
            : "bg-black/5 text-black/35 dark:bg-white/10 dark:text-white/35"
      }`}
    >
      {showCheck ? (
        <Check className="size-4 stroke-[2.5]" aria-hidden />
      ) : (
        index + 1
      )}
    </span>
  );
}

function StatusGlyph({
  status,
  highlight,
}: {
  status: OrderStatus;
  highlight: boolean;
}) {
  const key = toTrackingStepKey(status);
  const Icon =
    key === "CANCELLED"
      ? XCircle
      : key === "DELIVERED"
        ? Check
        : key === "READY"
          ? ChefHat
          : key === "IN_PREPARATION"
            ? Sparkles
            : Clock;

  return (
    <div
      key={status}
      className={`flex size-20 items-center justify-center rounded-3xl bg-white/20 shadow-inner backdrop-blur-sm transition-transform duration-500 animate-[pop_0.4s_ease-out] ${
        highlight ? "ring-4 ring-white/40" : ""
      }`}
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
