"use client";

/**
 * Tarjeta/comanda del monitor de cocina — agrupada por rondas.
 */

import { useMemo } from "react";
import { Check } from "lucide-react";
import type { Order, OrderItem, OrderItemStatus, OrderStatus } from "@/types/api";
import { maxBatchNumber } from "@/lib/order-mapper";

interface OrderTicketProps {
  order: Order;
  /** Reloj compartido del monitor (evita un interval por ticket). */
  now: number;
  isNew?: boolean;
  isAddition?: boolean;
  isSelected?: boolean;
  isUpdating?: boolean;
  updatingItemId?: number | null;
  errorMessage?: string | null;
  /** Bloquea mutaciones (p. ej. sin conexión). */
  actionsLocked?: boolean;
  /** Bloquea solo avance/cobro (p. ej. pendiente de revisión urgente). */
  advanceLocked?: boolean;
  onAdvance: (order: Order) => void;
  onCloseAccount: (order: Order) => void;
  onItemStatus: (order: Order, item: OrderItem, status: OrderItemStatus) => void;
  onSelect?: (order: Order) => void;
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
    case "IN_TABLE": {
      const primary = order.tableNumber?.trim();
      const linked = (order.linkedTables ?? [])
        .map((t) => t.trim())
        .filter(Boolean);
      if (primary && linked.length > 0) {
        const all = [primary, ...linked].sort((a, b) =>
          a.localeCompare(b, "es", { numeric: true }),
        );
        return `Mesa ${all.join("-")}`;
      }
      return primary ? `Mesa ${primary}` : "En mesa";
    }
    case "PICKUP":
      return "Para llevar";
    case "DELIVERY":
      return "A domicilio";
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
        label: "Aceptar",
        className: "bg-warn text-warn-foreground hover:brightness-95",
      };
    case "ACCEPTED":
      return {
        label: "Cocinar",
        className: "bg-primary text-primary-foreground hover:bg-primary/90",
      };
    case "IN_KITCHEN":
      return {
        label: "Listo",
        className: "bg-live text-live-foreground hover:brightness-110",
      };
    default:
      return null;
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
  now,
  isNew = false,
  isAddition = false,
  isSelected = false,
  isUpdating = false,
  updatingItemId = null,
  errorMessage = null,
  actionsLocked = false,
  advanceLocked = false,
  onAdvance,
  onCloseAccount,
  onItemStatus,
  onSelect,
}: OrderTicketProps) {
  const action = nextAction(order.status);
  const latestBatch = maxBatchNumber(order);
  const rounds = useMemo(() => groupByBatch(order.items), [order.items]);
  const showItemDeliver = order.status === "IN_KITCHEN";
  const showTotal = order.status === "DELIVERED";
  const controlsDisabled = isUpdating || actionsLocked;
  const stageDisabled = controlsDisabled || advanceLocked;

  const elapsed = formatElapsed(order.createdAt, now);
  const ageMs = now - new Date(order.createdAt).getTime();
  const urgent = ageMs > 15 * 60 * 1000;

  return (
    <article
      id={`kitchen-ticket-${order.uuid}`}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(order) : undefined}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === " " || event.key === "Spacebar") {
                event.preventDefault();
                onSelect(order);
              }
            }
          : undefined
      }
      aria-current={isSelected ? "true" : undefined}
      aria-label={
        onSelect
          ? `${orderTypeLabel(order)}${isSelected ? ", seleccionada" : ""}`
          : undefined
      }
      className={`flex flex-col rounded-2xl border bg-background p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-[box-shadow,border-color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
        isSelected
          ? "border-live ring-2 ring-live/40 ring-offset-2 ring-offset-card"
          : isNew || isAddition
            ? "border-warn"
            : order.orderType === "PICKUP" || order.orderType === "DELIVERY"
              ? "border-channel/70"
              : urgent
                ? "border-destructive"
                : "border-border"
      }`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
            #
            {order.id != null
              ? order.id
              : order.uuid.slice(0, 8).toUpperCase()}
          </p>
          <h3 className="truncate text-xl font-bold tracking-tight">
            {orderTypeLabel(order)}
          </h3>
          {order.orderType === "PICKUP" || order.orderType === "DELIVERY" ? (
            <p className="mt-0.5 truncate text-sm font-medium text-channel-ink">
              {[order.customerName?.trim(), order.customerPhone?.trim()]
                .filter(Boolean)
                .join(" · ") || "Sin datos del cliente"}
            </p>
          ) : order.staffName ? (
            <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
              Atendido por: {order.staffName}
            </p>
          ) : order.customerName ? (
            <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
              {order.customerName}
            </p>
          ) : null}
          {isAddition || isNew || urgent ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isAddition ? (
                <span className="inline-flex rounded-full bg-warn px-2.5 py-0.5 text-xs font-bold text-warn-foreground">
                  Adición
                </span>
              ) : isNew ? (
                <span className="inline-flex rounded-full bg-warn px-2.5 py-0.5 text-xs font-bold text-warn-foreground">
                  Nuevo
                </span>
              ) : null}
              {urgent ? (
                <span
                  className="inline-flex rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold text-destructive-foreground"
                  title="Lleva más de 15 minutos sin cerrar esta etapa"
                >
                  Tarde
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <p
          className={`shrink-0 text-2xl font-bold tabular-nums leading-none ${
            urgent ? "text-destructive" : "text-foreground"
          }`}
          aria-label={
            urgent ? `Tiempo ${elapsed}, tarde (+15 min)` : `Tiempo ${elapsed}`
          }
        >
          {elapsed}
        </p>
      </header>

      <div className="mb-3 flex-1 space-y-3 border-y border-dashed border-border py-3">
        {latestBatch > 1 ? (
          <p className="text-xs text-muted-foreground">
            Cada ronda es un envío aparte · prioriza la marcada Nueva
          </p>
        ) : null}
        {rounds.map(({ batch, items }) => {
          const isLatest = batch === latestBatch && latestBatch > 1;
          return (
            <section key={batch}>
              {latestBatch > 1 ? (
                <div className="mb-1.5 flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">
                    Ronda {batch}
                  </h4>
                  {isLatest ? (
                    <span
                      className="rounded-full bg-warn-muted px-2 py-0.5 text-xs font-bold text-warn-ink"
                      title="Último envío del comensal"
                    >
                      Nueva
                    </span>
                  ) : null}
                </div>
              ) : null}
              <ul className="space-y-1">
                {items.map((item, index) => {
                  const delivered = item.status === "DELIVERED";
                  const key =
                    item.id ?? `${item.productUuid}-${batch}-${index}`;
                  const itemBusy =
                    updatingItemId != null && item.id === updatingItemId;
                  return (
                    <li
                      key={key}
                      className={`rounded-lg px-2.5 py-1.5 ${
                        delivered
                          ? "opacity-55"
                          : isLatest
                            ? "bg-warn-muted"
                            : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-base leading-snug">
                          <div className="flex items-baseline gap-2">
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
                            <p className="mt-0.5 text-sm font-medium italic text-warn-ink">
                              Obs: {item.notes}
                            </p>
                          ) : null}
                          {item.modifiers?.length ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {item.modifiers
                                .map((m) =>
                                  m.priceDelta > 0
                                    ? `${m.name} (+${m.formattedPriceDelta})`
                                    : m.name,
                                )
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        {showItemDeliver && item.id != null && !delivered ? (
                          <button
                            type="button"
                            disabled={controlsDisabled || itemBusy}
                            title={
                              actionsLocked
                                ? "Sin conexión · no se puede marcar"
                                : "Marcar platillo servido (no cierra la comanda)"
                            }
                            aria-label={`Marcar platillo servido: ${item.productName}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onItemStatus(order, item, "DELIVERED");
                            }}
                            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`}
                          >
                            {itemBusy ? (
                              <span className="text-xs font-bold">…</span>
                            ) : (
                              <Check
                                className="size-5 stroke-[2.5]"
                                aria-hidden
                              />
                            )}
                          </button>
                        ) : delivered ? (
                          <Check
                            className="mt-1.5 size-4 shrink-0 text-live"
                            aria-hidden
                          />
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
        <p className="mb-3 text-sm font-medium text-channel-ink">
          Dir: {order.deliveryAddress}
        </p>
      ) : null}

      {showTotal ? (
        <div className="mb-3 flex items-center justify-between text-base">
          <span className="font-medium text-muted-foreground">Total</span>
          <span className="text-lg font-bold tabular-nums">
            {order.formattedTotal}
          </span>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      {showItemDeliver ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {advanceLocked
            ? "Confirma Revisado arriba antes de marcar Listo"
            : "Listo pasa la comanda a Por cobrar. El check marca un platillo ya servido; no cierra la cuenta."}
        </p>
      ) : null}

      {action ? (
        <button
          type="button"
          disabled={stageDisabled}
          title={
            actionsLocked
              ? "Sin conexión · espera a reconectar"
              : advanceLocked
                ? "Revisa la comanda y pulsa Revisado"
                : action.label === "Listo"
                  ? "Pasa la comanda a Por cobrar"
                  : undefined
          }
          onClick={(event) => {
            event.stopPropagation();
            onAdvance(order);
          }}
          className={`min-h-12 w-full rounded-xl px-4 py-3 text-base font-bold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${action.className} ${focusRing}`}
        >
          {isUpdating && updatingItemId == null
            ? "Actualizando…"
            : action.label}
        </button>
      ) : null}

      {order.status === "DELIVERED" ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {advanceLocked
              ? "Confirma Revisado arriba antes de cobrar"
              : order.orderType === "IN_TABLE"
                ? "Cobrar registra el pago, cierra la cuenta y libera la mesa."
                : "Cobrar registra el pago y cierra la cuenta."}
          </p>
          <button
            type="button"
            disabled={stageDisabled}
            title={
              actionsLocked
                ? "Sin conexión · no se puede cobrar"
                : advanceLocked
                  ? "Revisa la comanda y pulsa Revisado"
                  : order.orderType === "IN_TABLE"
                    ? "Cierra la cuenta y libera la mesa"
                    : "Cierra la cuenta"
            }
            onClick={(event) => {
              event.stopPropagation();
              onCloseAccount(order);
            }}
            className={`min-h-12 w-full rounded-xl bg-live px-4 py-3 text-base font-bold text-live-foreground transition-transform hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            {isUpdating && updatingItemId == null ? "Cerrando…" : "Cobrar"}
          </button>
        </>
      ) : null}
    </article>
  );
}
