"use client";

/**
 * Tracking en vivo del pedido del comensal.
 *
 * Snapshot inicial (SSR/REST) + suscripción STOMP/SockJS a `/topic/order/{uuid}`.
 * Stepper: Recibido → Confirmado → Preparando → Entregado.
 * Harden: live hasta CLOSED/CANCELLED; degradación, Actualizar, pedir ayuda.
 * Clarify: “qué hago mientras”; grupos claros; Servido legible; timeline con etapas.
 * Distill: hero dueño del estado; pedidos previos servidos colapsados.
 * Typeset: etapas del timeline con contraste total; jerarquía por peso.
 * Adapt: atajos Ir al pedido reciente / Ir al total en resúmenes largos.
 * Polish: scroll suave en atajos; aria-current en Entregado; copy de ayuda.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChefHat, Clock, Receipt, Sparkles, XCircle } from "lucide-react";
import type { Order, OrderItem, OrderStatus } from "@/types/api";
import {
  getOrderChannelLabel,
  getOrderSummaryTitle,
  getStatusDescription,
  getStatusIndex,
  getStatusLabel,
  getStatusTheme,
  toTrackingStepKey,
  TRACKING_STEPS,
} from "@/lib/order-status";
import { maxBatchNumber } from "@/lib/order-mapper";
import { buildMenuPath } from "@/lib/qr-menu-url";
import { useCartStore } from "@/store/cartStore";
import { whatsappChatUrl } from "@/lib/contact-links";
import { CustomerBrandHeader } from "@/components/customer/customer-brand-header";
import { SmartRatingSheet } from "@/components/customer/smart-rating-sheet";
import { getOrderByUuid } from "@/services/orderService";
import {
  getFeedbackStatus,
  wasFeedbackSubmittedLocally,
} from "@/services/feedbackService";
import {
  useOrderStatusSubscription,
  type OrderConnectionState,
} from "@/hooks/useOrderStatusSubscription";

/**
 * Layout (Operate):
 * 1) Encabezado de marca (como menú)  2) Estado  3) Progreso  4) Resumen  5) Rail.
 */
const LIVE_STALE_MS = 12_000;

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface OrderTrackerProps {
  initialOrder: Order;
  restaurantName: string;
  tenantSlug: string;
  whatsapp?: string | null;
  logoUrl?: string | null;
  hasBrandFill?: boolean;
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

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRoundFullyServed(items: OrderItem[]): boolean {
  return items.length > 0 && items.every((item) => item.status === "DELIVERED");
}

function platilloCountLabel(items: OrderItem[]): string {
  const n = items.reduce((sum, item) => sum + item.quantity, 0);
  return n === 1 ? "1 platillo" : `${n} platillos`;
}

function scrollToId(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: "start",
  });
}

function OrderLineItems({
  items,
  emphasizeNow,
}: {
  items: OrderItem[];
  emphasizeNow: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item, index) => {
        const delivered = item.status === "DELIVERED";
        return (
          <li
            key={item.id ?? `${item.productUuid}-${item.batchNumber}-${index}`}
            className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p
                className={`break-words text-sm font-medium [overflow-wrap:anywhere] ${
                  delivered ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                <span
                  className={`tabular-nums ${
                    delivered
                      ? "text-muted-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.quantity}×
                </span>{" "}
                {item.productName}
              </p>
              <p
                className={`mt-0.5 text-xs font-semibold uppercase tracking-wide ${
                  delivered ? "text-live" : "text-muted-foreground"
                }`}
              >
                {delivered
                  ? "Servido"
                  : item.status === "PREPARING"
                    ? "En cocina"
                    : emphasizeNow
                      ? "Pedido ahora"
                      : "Pendiente"}
              </p>
              {item.notes ? (
                <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {item.notes}
                </p>
              ) : null}
            </div>
            <span className="max-w-[36%] shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {item.formattedSubtotal}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function OrderTracker({
  initialOrder,
  restaurantName,
  tenantSlug,
  whatsapp = null,
  logoUrl = null,
  hasBrandFill = false,
}: OrderTrackerProps) {
  const [order, setOrder] = useState(initialOrder);
  const [connection, setConnection] =
    useState<OrderConnectionState>("connecting");
  const [disconnectedSince, setDisconnectedSince] = useState<number | null>(
    null,
  );
  const [liveStale, setLiveStale] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [helpHint, setHelpHint] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(() =>
    useCartStore.persist.hasHydrated(),
  );
  const ensureTenant = useCartStore((state) => state.ensureTenant);
  const clearActiveOrderSession = useCartStore(
    (state) => state.clearActiveOrderSession,
  );
  const setActiveOrderSession = useCartStore(
    (state) => state.setActiveOrderSession,
  );
  const waUrl = useMemo(
    () =>
      whatsappChatUrl(whatsapp, {
        text: `Hola, necesito ayuda con el pedido #${order.uuid.slice(0, 8)}.`,
      }),
    [whatsapp, order.uuid],
  );
  const staleTimerRef = useRef<number | null>(null);

  const isSettled =
    order.status === "CLOSED" || order.status === "CANCELLED";
  /** Comida lista / cuenta: deja de ofrecer «Pedir más». */
  const isOrderingDone =
    order.status === "DELIVERED" || isSettled;

  useEffect(() => {
    if (order.status !== "CLOSED" || feedbackDone) return;
    if (wasFeedbackSubmittedLocally(order.uuid)) {
      setFeedbackDone(true);
      return;
    }
    let cancelled = false;
    void getFeedbackStatus(order.uuid, tenantSlug)
      .then((status) => {
        if (cancelled) return;
        if (status.submitted) {
          setFeedbackDone(true);
          return;
        }
        setRatingOpen(true);
      })
      .catch(() => {
        // Si falla el status, el comensal puede abrir el sheet a mano.
      });
    return () => {
      cancelled = true;
    };
  }, [order.status, order.uuid, tenantSlug, feedbackDone]);

  const applyOrderUpdate = useCallback((next: Order) => {
    setOrder(next);
    setLastSyncedAt(Date.now());
    setRefreshMessage(null);
  }, []);

  const handleConnectionChange = useCallback((state: OrderConnectionState) => {
    setConnection(state);
    if (state === "connected") {
      setDisconnectedSince(null);
      setLiveStale(false);
      setHelpHint(false);
      setLastSyncedAt(Date.now());
      if (staleTimerRef.current != null) {
        window.clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      return;
    }
    if (state === "disconnected") {
      setDisconnectedSince((prev) => prev ?? Date.now());
    }
  }, []);

  useEffect(() => {
    if (isSettled || connection === "connected") {
      if (staleTimerRef.current != null) {
        window.clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      if (connection === "connected") setLiveStale(false);
      return;
    }
    if (connection !== "disconnected" || disconnectedSince == null) return;

    const elapsed = Date.now() - disconnectedSince;
    if (elapsed >= LIVE_STALE_MS) {
      setLiveStale(true);
      return;
    }

    staleTimerRef.current = window.setTimeout(() => {
      setLiveStale(true);
      staleTimerRef.current = null;
    }, LIVE_STALE_MS - elapsed);

    return () => {
      if (staleTimerRef.current != null) {
        window.clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
    };
  }, [connection, disconnectedSince, isSettled]);

  useEffect(() => {
    const unsub = useCartStore.persist.onFinishHydration(() => {
      setCartHydrated(true);
    });
    if (useCartStore.persist.hasHydrated()) {
      setCartHydrated(true);
    }
    return unsub;
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    ensureTenant(tenantSlug);
  }, [cartHydrated, ensureTenant, tenantSlug]);

  useEffect(() => {
    if (!cartHydrated) return;
    if (isOrderingDone) {
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
    cartHydrated,
    clearActiveOrderSession,
    isOrderingDone,
    order.customerName,
    order.orderType,
    order.tableNumber,
    order.uuid,
    setActiveOrderSession,
  ]);

  useOrderStatusSubscription({
    orderUuid: order.uuid,
    enabled: !isSettled,
    onUpdate: applyOrderUpdate,
    onConnectionChange: handleConnectionChange,
  });

  async function handleRefreshOrder() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const next = await getOrderByUuid(order.uuid, tenantSlug);
      applyOrderUpdate(next);
      setRefreshMessage(`Pedido actualizado · ${formatClock(Date.now())}`);
    } catch {
      setRefreshMessage(
        "No pudimos actualizar. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const theme = getStatusTheme(order.status);
  const currentIndex = getStatusIndex(order.status);
  const isCancelled = order.status === "CANCELLED";
  const isClosed = order.status === "CLOSED";
  const isFoodDelivered = order.status === "DELIVERED";
  const showFoodProgress = !isCancelled && !isClosed;
  const showRateCta = isClosed && !feedbackDone;
  const channelLabel = getOrderChannelLabel(
    order.orderType,
    order.tableNumber,
  );
  const summaryTitle = getOrderSummaryTitle(
    order.orderType,
    order.tableNumber,
  );
  const latestBatch = maxBatchNumber(order);
  const rounds = useMemo(() => groupByBatch(order.items), [order.items]);
  const showReceiptJumps =
    order.items.length >= 6 || rounds.length >= 3;
  const showLiveDegraded = !isSettled && liveStale;
  const sinceLabel =
    disconnectedSince != null ? formatClock(disconnectedSince) : null;
  const isInTable = order.orderType === "IN_TABLE";
  const tableToken = useCartStore((s) => s.tableToken);
  const menuHref =
    isInTable && order.tableNumber?.trim()
      ? buildMenuPath(order.tableNumber.trim(), tableToken)
      : "/menu";
  const primaryAction =
    !isOrderingDone && isInTable
      ? {
          href: menuHref,
          label: "Pedir más" as const,
          hint: null as string | null,
        }
      : isOrderingDone
        ? {
            href: "/menu",
            label: "Explorar menú" as const,
            hint: "Solo para ver la carta; no suma a este pedido." as
              | string
              | null,
          }
        : {
            href: "/menu",
            label: "Ver menú" as const,
            hint: null as string | null,
          };

  return (
    <div className="flex flex-col gap-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <CustomerBrandHeader
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        supportLine={`Tu pedido · ${channelLabel}`}
        hasBrandFill={hasBrandFill}
      />

      <div className="flex flex-col gap-6 px-4">
      <section
        aria-live="polite"
        className={`rounded-3xl border border-border px-5 py-7 text-center shadow-sm ${
          isClosed ? "bg-secondary/40" : "bg-card"
        }`}
      >
        <div className="flex flex-col items-center">
          <StatusGlyph
            status={order.status}
            highlight={isFoodDelivered}
          />
          <p
            key={order.status}
            className="mt-4 text-2xl font-extrabold tracking-tight text-foreground motion-safe:animate-[fade-up_0.45s_ease-out]"
          >
            {getStatusLabel(order.status)}
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {getStatusDescription(order.status, order.orderType)}
          </p>
          <p className="mt-3 text-xs tabular-nums tracking-wide text-muted-foreground">
            #{order.uuid.slice(0, 8)}
          </p>
        </div>

        <ConnectionHint
          state={connection}
          terminal={isSettled}
          degraded={showLiveDegraded}
          sinceLabel={sinceLabel}
          awaitingAccountClose={isFoodDelivered && !isSettled}
        />
      </section>

      {showLiveDegraded ? (
        <div
          role="alert"
          className="rounded-2xl border border-warn/40 bg-warn-muted px-4 py-3 text-warn-foreground"
        >
          <p className="text-sm font-semibold text-warn-ink">
            {sinceLabel
              ? `Sin conexión en vivo desde ${sinceLabel}`
              : "Sin conexión en vivo"}
          </p>
          <p className="mt-1 text-sm leading-snug text-warn-ink/90">
            Mostramos el último estado conocido
            {lastSyncedAt
              ? ` (actualizado a las ${formatClock(lastSyncedAt)})`
              : ""}
            . Puedes actualizar o pedir ayuda al personal.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={isRefreshing}
              aria-busy={isRefreshing}
              onClick={() => {
                void handleRefreshOrder();
              }}
              className={`${focusRing} inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-warn px-4 text-sm font-bold text-warn-foreground disabled:pointer-events-none disabled:opacity-60`}
            >
              {isRefreshing ? "Actualizando…" : "Actualizar pedido"}
            </button>
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${focusRing} inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-warn/50 bg-background/80 px-4 text-sm font-semibold text-warn-ink`}
              >
                Pedir ayuda por WhatsApp
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setHelpHint(true)}
                className={`${focusRing} inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-warn/50 bg-background/80 px-4 text-sm font-semibold text-warn-ink`}
              >
                Pedir ayuda al personal
              </button>
            )}
          </div>
          {helpHint && !waUrl ? (
            <p role="status" className="mt-2 text-sm leading-snug text-warn-ink">
              Habla con el mesero o en caja y menciona el pedido #
              {order.uuid.slice(0, 8)}.
            </p>
          ) : null}
        </div>
      ) : null}

      {refreshMessage ? (
        <p
          role="status"
          aria-live="polite"
          className={`-mt-2 text-center text-sm ${
            refreshMessage.startsWith("No pudimos")
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {refreshMessage}
        </p>
      ) : null}

      {showFoodProgress ? (
      <ol
        className="flex items-start justify-between gap-1 px-2"
        aria-label="Progreso del pedido"
      >
        {TRACKING_STEPS.map((step, index) => {
          const complete = index < currentIndex || isFoodDelivered;
          const active = index === currentIndex && !isFoodDelivered;
          const showCheck =
            complete || (active && step.key === "DELIVERED");

          return (
            <li
              key={step.key}
              aria-current={
                active || (isFoodDelivered && step.key === "DELIVERED")
                  ? "step"
                  : undefined
              }
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex w-full items-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={`h-0.5 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-500 ${
                      index <= currentIndex || isFoodDelivered
                        ? "bg-live"
                        : "bg-border"
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
                    className={`h-0.5 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-500 ${
                      index < currentIndex || isFoodDelivered
                        ? "bg-live"
                        : "bg-border"
                    }`}
                  />
                ) : (
                  <span className="flex-1" />
                )}
              </div>
              <span
                className={`max-w-[4.75rem] text-center text-xs leading-snug ${
                  active
                    ? "font-semibold text-foreground"
                    : complete
                      ? "font-medium text-muted-foreground"
                      : "font-normal text-muted-foreground"
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
        className="rounded-3xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="mb-4 min-w-0">
          <h2 className="text-base font-bold">{summaryTitle}</h2>
          <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {[
              order.customerName?.trim() || null,
              order.orderType === "DELIVERY" && order.deliveryAddress?.trim()
                ? order.deliveryAddress.trim()
                : null,
            ]
              .filter(Boolean)
              .join(" · ") ||
              (isInTable ? "Tu pedido de la mesa" : null)}
          </p>
          {showReceiptJumps ? (
            <nav
              aria-label="Atajos del resumen"
              className="mt-3 flex flex-wrap gap-x-4 gap-y-1"
            >
              {rounds.length > 1 ? (
                <button
                  type="button"
                  onClick={() => scrollToId(`order-round-${latestBatch}`)}
                  className={`${focusRing} inline-flex min-h-11 items-center text-xs font-semibold text-[var(--menu-accent)] underline underline-offset-2`}
                >
                  Ir al pedido reciente
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => scrollToId("order-total")}
                className={`${focusRing} inline-flex min-h-11 items-center text-xs font-semibold text-[var(--menu-accent)] underline underline-offset-2`}
              >
                Ir al total
              </button>
            </nav>
          ) : null}
        </div>

        <div className="space-y-5">
          {rounds.length > 1 ? (
            <p className="text-xs leading-snug text-muted-foreground">
              Cada grupo es lo que pediste en un momento distinto.
            </p>
          ) : null}
          {rounds.map(({ batch, items }) => {
            const showRoundHeaders = rounds.length > 1;
            const isLatest = showRoundHeaders && batch === latestBatch;
            const collapseServed =
              showRoundHeaders && !isLatest && isRoundFullyServed(items);

            if (collapseServed) {
              return (
                <details
                  key={batch}
                  id={`order-round-${batch}`}
                  className="group scroll-mt-28 border-b border-border pb-3"
                >
                  <summary
                    className={`${focusRing} flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm marker:content-none [&::-webkit-details-marker]:hidden`}
                  >
                    <span className="min-w-0 text-left">
                      <span className="font-semibold text-foreground">
                        Pedido {batch}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {platilloCountLabel(items)} servidos
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <div className="pt-1">
                    <OrderLineItems items={items} emphasizeNow={false} />
                  </div>
                </details>
              );
            }

            return (
              <div
                key={batch}
                id={`order-round-${batch}`}
                className="scroll-mt-28"
              >
                {showRoundHeaders ? (
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Pedido {batch}
                    </h3>
                    {isLatest ? (
                      <span className="rounded-full bg-warn-muted px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-warn-ink">
                        Pedido adicional
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <OrderLineItems items={items} emphasizeNow={isLatest} />
              </div>
            );
          })}
        </div>

        <div
          id="order-total"
          className="mt-4 flex scroll-mt-28 items-center justify-between border-t border-border pt-4"
        >
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-extrabold tabular-nums text-foreground">
            {order.formattedTotal}
          </span>
        </div>
      </section>
      </div>

      <nav
        aria-label="Siguiente paso"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          {showRateCta ? (
            <button
              type="button"
              onClick={() => setRatingOpen(true)}
              className={`${focusRing} inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm`}
            >
              Calificar experiencia
            </button>
          ) : null}
          <Link
            href={primaryAction.href}
            className={`${focusRing} inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--menu-accent)] px-5 text-sm font-semibold text-[var(--menu-accent-fg)] shadow-md`}
          >
            {primaryAction.label}
          </Link>
          {primaryAction.hint ? (
            <p className="text-center text-xs leading-snug text-muted-foreground">
              {primaryAction.hint}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {!isSettled && !showLiveDegraded ? (
              <button
                type="button"
                disabled={isRefreshing}
                aria-busy={isRefreshing}
                onClick={() => {
                  void handleRefreshOrder();
                }}
                className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2 disabled:pointer-events-none disabled:opacity-60`}
              >
                {isRefreshing ? "Actualizando…" : "Actualizar"}
              </button>
            ) : null}
            {!showLiveDegraded ? (
              waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2`}
                >
                  Pedir ayuda
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setHelpHint(true)}
                  className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2`}
                >
                  Pedir ayuda
                </button>
              )
            ) : null}
          </div>
          {helpHint && !waUrl && !showLiveDegraded ? (
            <p
              role="status"
              className="text-center text-xs leading-snug text-muted-foreground"
            >
              Habla con el mesero o en caja · pedido #{order.uuid.slice(0, 8)}
            </p>
          ) : null}
        </div>
      </nav>

      <SmartRatingSheet
        open={ratingOpen}
        orderUuid={order.uuid}
        tenantSlug={tenantSlug}
        restaurantName={restaurantName}
        onClose={() => setRatingOpen(false)}
        onCompleted={() => setFeedbackDone(true)}
      />
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
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold motion-safe:transition-all motion-safe:duration-500 ${
        showCheck
          ? "bg-live text-white"
          : active
            ? `bg-card text-foreground ring-2 ${ringClass}/40 motion-safe:scale-105 ${
                preparing ? "motion-safe:animate-pulse" : ""
              }`
            : "bg-secondary text-muted-foreground"
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
    status === "CLOSED"
      ? Receipt
      : key === "CANCELLED"
        ? XCircle
        : key === "DELIVERED"
          ? Check
          : key === "READY"
            ? ChefHat
            : key === "IN_PREPARATION"
              ? Sparkles
              : Clock;

  const mutedClosed = status === "CLOSED";

  return (
    <div
      key={status}
      className={`flex size-20 items-center justify-center rounded-3xl shadow-inner motion-safe:animate-[pop_0.4s_ease-out] motion-safe:transition-transform motion-safe:duration-500 ${
        mutedClosed
          ? "bg-secondary text-muted-foreground"
          : "bg-[var(--menu-accent-muted)] text-[var(--menu-accent)]"
      } ${highlight ? "ring-4 ring-[var(--menu-accent)]/25" : ""}`}
    >
      <Icon className="size-10 stroke-[1.5]" aria-hidden />
    </div>
  );
}

function ConnectionHint({
  state,
  terminal,
  degraded,
  sinceLabel,
  awaitingAccountClose = false,
}: {
  state: OrderConnectionState;
  terminal: boolean;
  degraded: boolean;
  sinceLabel: string | null;
  awaitingAccountClose?: boolean;
}) {
  if (terminal) return null;

  const label = degraded
    ? sinceLabel
      ? `Sin conexión desde ${sinceLabel} · se muestra el último estado conocido`
      : "Sin conexión · se muestra el último estado conocido"
    : state === "connected"
      ? awaitingAccountClose
        ? "En vivo · te avisamos si se cierra la cuenta"
        : "En vivo · actualizaciones automáticas"
      : state === "connecting"
        ? "Conectando en tiempo real…"
        : "Reconectando…";

  return (
    <p
      role="status"
      className="mt-6 flex items-center justify-center gap-2 text-center text-xs font-medium text-muted-foreground"
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          state === "connected" && !degraded
            ? "bg-live shadow-[0_0_8px_color-mix(in_srgb,var(--live)_55%,transparent)]"
            : degraded
              ? "bg-warn"
              : "bg-muted-foreground motion-safe:animate-pulse"
        }`}
      />
      {label}
    </p>
  );
}
