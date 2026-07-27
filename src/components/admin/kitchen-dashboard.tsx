"use client";

/**
 * Monitor en vivo de cocina/caja (Kanban de comandas).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import type { Order, OrderItem, OrderItemStatus, OrderStatus } from "@/types/api";
import { AdminConnectionBadge } from "@/components/admin/admin-connection-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminRovingTablist } from "@/components/admin/admin-roving-tablist";
import { OrderTicket } from "@/components/admin/order-ticket";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { useKitchenAlertSound } from "@/hooks/useKitchenAlertSound";
import {
  closeOrder,
  updateOrderItemStatus,
  updateOrderStatus,
} from "@/services/adminOrderService";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { maxBatchNumber } from "@/lib/order-mapper";

const UNDO_WINDOW_MS = 9_000;
/** Misma regla visual que el borde rojo del ticket. */
const URGENT_AFTER_MS = 15 * 60 * 1000;
/** Tras saltar al urgente: si el ticket sigue seleccionado, se libera el gate. */
const REVIEW_GATE_DWELL_MS = 2_500;
/** Carriles donde la edad cuenta como urgente (cross-lane). */
const URGENCY_LANES: readonly OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
];

const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
];

const COLUMNS: Array<{
  status: OrderStatus;
  title: string;
  cue: string;
  empty: string;
  chip: string;
}> = [
  {
    status: "PENDING",
    title: "Recibidos",
    cue: "Nuevos · Aceptar para pasarlos",
    empty: "Sin pedidos nuevos. Los que lleguen aparecen aquí al instante.",
    chip: "bg-warn-muted text-warn-ink",
  },
  {
    status: "ACCEPTED",
    title: "Aceptados",
    cue: "En cola · Cocinar cuando toque",
    empty: "Nada en cola. Los aceptados esperan aquí antes de cocina.",
    chip: "bg-secondary text-foreground ring-1 ring-border",
  },
  {
    status: "IN_KITCHEN",
    title: "En cocina",
    cue: "Preparando · Listo = a cobrar · check = platillo servido",
    empty: "Cocina libre. Manda un aceptado con Cocinar.",
    chip: "bg-secondary text-foreground ring-1 ring-border",
  },
  {
    status: "DELIVERED",
    title: "Por cobrar",
    cue: "Servidos · Cobrar cierra la cuenta",
    empty: "Nada por cobrar. El cobro solo se hace en esta etapa.",
    chip: "bg-live-muted text-live-ink",
  },
];

interface KitchenDashboardProps {
  tenantSlug: string;
  restaurantName: string;
  initialOrders: Order[];
  /** UUID desde Pedidos (`?order=`) para enfocar carril + ticket. */
  focusOrderUuid?: string | null;
}

const FOCUS_PRIORITY: OrderStatus[] = [
  "PENDING",
  "IN_KITCHEN",
  "ACCEPTED",
  "DELIVERED",
];

const LANE_PANEL_ID = "kitchen-focus-lane";

function nextStatusFor(status: OrderStatus): OrderStatus | null {
  if (status === "PENDING") return "ACCEPTED";
  if (status === "ACCEPTED") return "IN_KITCHEN";
  if (status === "IN_KITCHEN") return "DELIVERED";
  return null;
}

function columnTitleFor(status: OrderStatus): string {
  return COLUMNS.find((column) => column.status === status)?.title ?? status;
}

function orderWho(order: Order): string {
  if (order.orderType === "IN_TABLE") {
    return `Mesa ${order.tableNumber ?? "—"}`;
  }
  if (order.orderType === "PICKUP") {
    return order.customerName?.trim() || "Para llevar";
  }
  if (order.orderType === "DELIVERY") return "A domicilio";
  return `#${order.uuid.slice(0, 8).toUpperCase()}`;
}

function isOrderOverdue(order: Order, now: number): boolean {
  const start = new Date(order.createdAt).getTime();
  if (!Number.isFinite(start)) return false;
  return now - start > URGENT_AFTER_MS;
}

function orderAgeMinutes(order: Order, now: number): number {
  const start = new Date(order.createdAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 60_000));
}

function pickOldestOverdue(orders: Order[], now: number): Order | null {
  let oldest: Order | null = null;
  let oldestStart = Number.POSITIVE_INFINITY;
  for (const order of orders) {
    if (!URGENCY_LANES.includes(order.status)) continue;
    if (!isOrderOverdue(order, now)) continue;
    const start = new Date(order.createdAt).getTime();
    if (start < oldestStart) {
      oldest = order;
      oldestStart = start;
    }
  }
  return oldest;
}

function findActiveOrder(orders: Order[], uuid: string | null | undefined): Order | null {
  if (!uuid) return null;
  return (
    orders.find(
      (order) =>
        order.uuid === uuid && ACTIVE_STATUSES.includes(order.status),
    ) ?? null
  );
}

function pickFocusStatus(orders: Order[]): OrderStatus {
  for (const status of FOCUS_PRIORITY) {
    if (orders.some((order) => order.status === status)) return status;
  }
  return "PENDING";
}

type StatusUndo = {
  previous: Order;
  toStatus: OrderStatus;
  expiresAt: number;
};

type UrgentReviewGate = {
  uuid: string;
  status: OrderStatus;
};

function sortByCreatedAt(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function KitchenDashboard({
  tenantSlug,
  restaurantName,
  initialOrders,
  focusOrderUuid = null,
}: KitchenDashboardProps) {
  const router = useRouter();
  const deepLinkOrder = findActiveOrder(initialOrders, focusOrderUuid);
  const [orders, setOrders] = useState<Order[]>(() =>
    sortByCreatedAt(initialOrders),
  );
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [flashUuid, setFlashUuid] = useState<string | null>(null);
  const [additionUuid, setAdditionUuid] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [statusUndo, setStatusUndo] = useState<StatusUndo | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [closeTarget, setCloseTarget] = useState<Order | null>(null);
  const [closing, setClosing] = useState(false);
  const [updatingUuid, setUpdatingUuid] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
  const [focusStatus, setFocusStatus] = useState<OrderStatus>(
    () => deepLinkOrder?.status ?? pickFocusStatus(initialOrders),
  );
  const [selectedUuid, setSelectedUuid] = useState<string | null>(
    () => deepLinkOrder?.uuid ?? null,
  );
  const [reviewGate, setReviewGate] = useState<UrgentReviewGate | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const focusTouchedRef = useRef(Boolean(deepLinkOrder));
  const deepLinkHandledRef = useRef(false);
  const knownUuidsRef = useRef(new Set(initialOrders.map((o) => o.uuid)));
  const batchByUuidRef = useRef(
    new Map(initialOrders.map((o) => [o.uuid, maxBatchNumber(o)])),
  );
  const undoTimerRef = useRef<number | null>(null);
  const playNewOrderCue = useKitchenAlertSound();

  // Refs for keyboard handlers (avoid stale closures)
  const focusStatusRef = useRef(focusStatus);
  const focusOrdersRef = useRef<Order[]>([]);
  const selectedUuidRef = useRef(selectedUuid);
  const statusUndoRef = useRef(statusUndo);
  const closeTargetRef = useRef(closeTarget);
  const updatingUuidRef = useRef(updatingUuid);
  const connectionRef = useRef(connection);
  const closingRef = useRef(closing);
  const reviewGateRef = useRef(reviewGate);
  focusStatusRef.current = focusStatus;
  selectedUuidRef.current = selectedUuid;
  statusUndoRef.current = statusUndo;
  closeTargetRef.current = closeTarget;
  updatingUuidRef.current = updatingUuid;
  connectionRef.current = connection;
  closingRef.current = closing;
  reviewGateRef.current = reviewGate;

  const actionsLocked = connection === "disconnected";
  const mutationsLive = !actionsLocked;

  function clearUndoTimer() {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function clearStatusUndo() {
    clearUndoTimer();
    setStatusUndo(null);
    setUndoSecondsLeft(0);
  }

  function scheduleUndoExpiry(expiresAt: number) {
    clearUndoTimer();

    const tick = () => {
      const leftMs = expiresAt - Date.now();
      const leftSec = Math.max(0, Math.ceil(leftMs / 1000));
      setUndoSecondsLeft(leftSec);
      if (leftMs <= 0) {
        setStatusUndo(null);
        setUndoSecondsLeft(0);
        undoTimerRef.current = null;
        return;
      }
      undoTimerRef.current = window.setTimeout(tick, 200);
    };

    tick();
  }

  const handleOrderEvent = useCallback(
    (incoming: Order) => {
      const isActive = ACTIVE_STATUSES.includes(incoming.status);
      const isNew = !knownUuidsRef.current.has(incoming.uuid);
      const prevBatch = batchByUuidRef.current.get(incoming.uuid) ?? 0;
      const nextBatch = maxBatchNumber(incoming);
      const isAddition = !isNew && nextBatch > prevBatch;

      setOrders((prev) => {
        const without = prev.filter((o) => o.uuid !== incoming.uuid);
        if (!isActive) return without;
        return isNew
          ? [incoming, ...without]
          : sortByCreatedAt([...without, incoming]);
      });

      batchByUuidRef.current.set(incoming.uuid, nextBatch);

      if (isNew && isActive) {
        knownUuidsRef.current.add(incoming.uuid);
        setFlashUuid(incoming.uuid);
        setBanner(
          `Nueva comanda · ${orderWho(incoming)} · #${incoming.uuid.slice(0, 8).toUpperCase()}`,
        );
        playNewOrderCue();
        window.setTimeout(() => {
          setFlashUuid((current) =>
            current === incoming.uuid ? null : current,
          );
          setBanner((current) =>
            current?.includes(incoming.uuid.slice(0, 8).toUpperCase())
              ? null
              : current,
          );
        }, 4_000);
      } else if (isAddition && isActive) {
        knownUuidsRef.current.add(incoming.uuid);
        setAdditionUuid(incoming.uuid);
        setBanner(
          `Adición · Mesa ${incoming.tableNumber ?? "—"} · Ronda ${nextBatch}`,
        );
        playNewOrderCue();
        window.setTimeout(() => {
          setAdditionUuid((current) =>
            current === incoming.uuid ? null : current,
          );
          setBanner((current) =>
            current?.includes(`Ronda ${nextBatch}`) ? null : current,
          );
        }, 5_000);
      } else if (isActive) {
        knownUuidsRef.current.add(incoming.uuid);
      } else {
        knownUuidsRef.current.delete(incoming.uuid);
        batchByUuidRef.current.delete(incoming.uuid);
      }
    },
    [playNewOrderCue],
  );

  useKitchenOrdersSubscription({
    tenantSlug,
    onOrderEvent: handleOrderEvent,
    onConnectionChange: setConnection,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!focusOrderUuid || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    const order = findActiveOrder(orders, focusOrderUuid);
    if (!order) {
      setBanner(
        "Esa cuenta ya no está activa en Cocina. Vuelve a Pedidos o elige otra comanda.",
      );
      window.setTimeout(() => setBanner(null), 5_000);
      router.replace("/admin/dashboard/kitchen", { scroll: false });
      return;
    }

    focusTouchedRef.current = true;
    setFocusStatus(order.status);
    setSelectedUuid(order.uuid);
    setBanner(
      `Desde Pedidos · ${orderWho(order)} · ${columnTitleFor(order.status)}`,
    );
    window.setTimeout(() => setBanner(null), 4_000);
    router.replace("/admin/dashboard/kitchen", { scroll: false });
  }, [focusOrderUuid, orders, router]);

  useEffect(() => {
    if (connection !== "disconnected") return;
    if (closing) return;
    setCloseTarget(null);
  }, [connection, closing]);

  async function handleAdvance(order: Order) {
    const next = nextStatusFor(order.status);
    if (!next || updatingUuid || closing || !mutationsLive) return;
    if (reviewGate && reviewGate.uuid === order.uuid) return;

    setUpdatingUuid(order.uuid);
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[order.uuid];
      return copy;
    });

    const optimistic: Order = { ...order, status: next };
    handleOrderEvent(optimistic);

    try {
      const updated = await updateOrderStatus(order.uuid, next, tenantSlug);
      handleOrderEvent(updated);
      const expiresAt = Date.now() + UNDO_WINDOW_MS;
      setStatusUndo({ previous: order, toStatus: next, expiresAt });
      scheduleUndoExpiry(expiresAt);
    } catch (error) {
      handleOrderEvent(order);
      clearStatusUndo();
      const message = getAdminErrorMessage(
        error,
        "No se pudo mover la comanda. Revisa la conexión e inténtalo de nuevo.",
      );
      setTicketErrors((prev) => ({ ...prev, [order.uuid]: message }));
    } finally {
      setUpdatingUuid(null);
    }
  }

  async function handleUndoAdvance() {
    if (!statusUndo || updatingUuid || closing || !mutationsLive) return;
    const { previous } = statusUndo;
    clearStatusUndo();

    setUpdatingUuid(previous.uuid);
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[previous.uuid];
      return copy;
    });
    handleOrderEvent(previous);

    try {
      const updated = await updateOrderStatus(
        previous.uuid,
        previous.status,
        tenantSlug,
      );
      handleOrderEvent(updated);
      setBanner(
        `Deshecho · ${orderWho(previous)} volvió a ${columnTitleFor(previous.status)}`,
      );
      window.setTimeout(() => setBanner(null), 3_500);
    } catch (error) {
      const message = getAdminErrorMessage(
        error,
        "No se pudo deshacer. La comanda quedó en la etapa nueva.",
      );
      setTicketErrors((prev) => ({ ...prev, [previous.uuid]: message }));
    } finally {
      setUpdatingUuid(null);
    }
  }

  async function handleItemStatus(
    order: Order,
    item: OrderItem,
    status: OrderItemStatus,
  ) {
    if (item.id == null || updatingUuid || closing || !mutationsLive) return;
    setUpdatingUuid(order.uuid);
    setUpdatingItemId(item.id);
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[order.uuid];
      return copy;
    });

    const optimistic: Order = {
      ...order,
      items: order.items.map((line) =>
        line.id === item.id ? { ...line, status } : line,
      ),
    };
    handleOrderEvent(optimistic);

    try {
      const updated = await updateOrderItemStatus(
        order.uuid,
        item.id,
        status,
        tenantSlug,
      );
      handleOrderEvent(updated);
    } catch (error) {
      handleOrderEvent(order);
      const message = getAdminErrorMessage(
        error,
        "No se pudo marcar el platillo. Inténtalo de nuevo.",
      );
      setTicketErrors((prev) => ({ ...prev, [order.uuid]: message }));
    } finally {
      setUpdatingUuid(null);
      setUpdatingItemId(null);
    }
  }

  async function handleConfirmClose() {
    if (!closeTarget || updatingUuid || closing || !mutationsLive) return;
    const order = closeTarget;
    setClosing(true);
    setUpdatingUuid(order.uuid);
    clearStatusUndo();
    setTicketErrors((prev) => {
      const copy = { ...prev };
      delete copy[order.uuid];
      return copy;
    });

    try {
      const updated = await closeOrder(order.uuid, tenantSlug);
      handleOrderEvent(updated);
      setCloseTarget(null);
      setBanner(
        order.orderType === "IN_TABLE"
          ? `Cuenta cobrada · ${orderWho(order)} · mesa liberada`
          : `Cuenta cobrada · ${orderWho(order)}`,
      );
      window.setTimeout(() => setBanner(null), 3_500);
    } catch (error) {
      const message = getAdminErrorMessage(
        error,
        "No se pudo cobrar. La cuenta sigue abierta; inténtalo de nuevo.",
      );
      setTicketErrors((prev) => ({ ...prev, [order.uuid]: message }));
    } finally {
      setClosing(false);
      setUpdatingUuid(null);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      PENDING: [],
      ACCEPTED: [],
      IN_KITCHEN: [],
      DELIVERED: [],
      CLOSED: [],
      CANCELLED: [],
    };
    for (const order of orders) {
      map[order.status]?.push(order);
    }
    return map;
  }, [orders]);

  const focusOrders = grouped[focusStatus] ?? [];
  focusOrdersRef.current = focusOrders;
  const focusOrderIds = focusOrders.map((order) => order.uuid).join(",");

  const overdueCounts = useMemo(() => {
    const counts: Partial<Record<OrderStatus, number>> = {
      PENDING: 0,
      ACCEPTED: 0,
      IN_KITCHEN: 0,
    };
    for (const order of orders) {
      if (!URGENCY_LANES.includes(order.status)) continue;
      if (!isOrderOverdue(order, now)) continue;
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    }
    return counts;
  }, [orders, now]);

  const oldestOverdue = useMemo(
    () => pickOldestOverdue(orders, now),
    [orders, now],
  );

  const showUrgentJump =
    Boolean(oldestOverdue) &&
    !(
      oldestOverdue &&
      focusStatus === oldestOverdue.status &&
      selectedUuid === oldestOverdue.uuid
    );

  function jumpToUrgent() {
    if (!oldestOverdue) return;
    const alreadySelected = selectedUuid === oldestOverdue.uuid;
    focusTouchedRef.current = true;
    setFocusStatus(oldestOverdue.status);
    setSelectedUuid(oldestOverdue.uuid);
    if (alreadySelected) {
      setReviewGate(null);
      return;
    }
    setReviewGate({
      uuid: oldestOverdue.uuid,
      status: oldestOverdue.status,
    });
  }

  const reviewGateOrder = reviewGate
    ? (orders.find((order) => order.uuid === reviewGate.uuid) ?? null)
    : null;

  useEffect(() => {
    if (!reviewGate) return;
    const order = orders.find((entry) => entry.uuid === reviewGate.uuid);
    if (!order || order.status !== reviewGate.status) {
      setReviewGate(null);
    }
  }, [orders, reviewGate]);

  useEffect(() => {
    if (!reviewGate) return;
    if (selectedUuid !== reviewGate.uuid) return;
    const id = window.setTimeout(() => {
      setReviewGate((current) =>
        current?.uuid === reviewGate.uuid ? null : current,
      );
    }, REVIEW_GATE_DWELL_MS);
    return () => window.clearTimeout(id);
  }, [reviewGate, selectedUuid]);

  useEffect(() => {
    if (!selectedUuid) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`kitchen-ticket-${selectedUuid}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedUuid, focusStatus]);

  useEffect(() => {
    if (focusOrders.length === 0) {
      setSelectedUuid(null);
      return;
    }
    setSelectedUuid((current) => {
      if (current && focusOrders.some((order) => order.uuid === current)) {
        return current;
      }
      return focusOrders[0]?.uuid ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when lane membership changes
  }, [focusStatus, focusOrderIds]);

  useEffect(() => {
    if (focusTouchedRef.current) return;
    if (focusOrders.length > 0 || orders.length === 0) return;
    const nextFocus = pickFocusStatus(orders);
    if (nextFocus !== focusStatus) setFocusStatus(nextFocus);
  }, [focusOrders.length, focusStatus, orders]);

  const handleAdvanceRef = useRef(handleAdvance);
  const handleUndoAdvanceRef = useRef(handleUndoAdvance);
  handleAdvanceRef.current = handleAdvance;
  handleUndoAdvanceRef.current = handleUndoAdvance;

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (closeTargetRef.current || closingRef.current) return;

      const key = event.key;
      const target =
        event.target instanceof HTMLElement ? event.target : null;

      if (key >= "1" && key <= "4") {
        const column = COLUMNS[Number(key) - 1];
        if (!column) return;
        event.preventDefault();
        focusTouchedRef.current = true;
        setFocusStatus(column.status);
        return;
      }

      if (key === "u" || key === "U") {
        if (connectionRef.current === "disconnected") return;
        if (!statusUndoRef.current || updatingUuidRef.current) return;
        event.preventDefault();
        void handleUndoAdvanceRef.current();
        return;
      }

      const lane = focusOrdersRef.current;
      if (lane.length === 0) return;

      if (key === "ArrowDown" || key === "j") {
        event.preventDefault();
        const index = Math.max(
          0,
          lane.findIndex((order) => order.uuid === selectedUuidRef.current),
        );
        const next = lane[Math.min(lane.length - 1, index + 1)];
        if (next) setSelectedUuid(next.uuid);
        return;
      }

      if (key === "ArrowUp" || key === "k") {
        event.preventDefault();
        const index = Math.max(
          0,
          lane.findIndex((order) => order.uuid === selectedUuidRef.current),
        );
        const next = lane[Math.max(0, index - 1)];
        if (next) setSelectedUuid(next.uuid);
        return;
      }

      if (key === "Enter") {
        if (
          target?.closest(
            "button, a, input, textarea, select, [role='button'], [role='tab']",
          )
        ) {
          return;
        }
        if (connectionRef.current === "disconnected") return;
        if (updatingUuidRef.current) return;
        const selected =
          lane.find((order) => order.uuid === selectedUuidRef.current) ??
          lane[0];
        if (!selected) return;
        const gate = reviewGateRef.current;
        if (gate && gate.uuid === selected.uuid) return;
        event.preventDefault();
        if (selected.status === "DELIVERED") {
          setCloseTarget(selected);
          return;
        }
        void handleAdvanceRef.current(selected);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function renderLane(status: OrderStatus, laneOrders: Order[]) {
    const column = COLUMNS.find((entry) => entry.status === status);
    if (!column) return null;

    return (
      <section
        aria-label={column.title}
        className="flex min-h-72 flex-col rounded-2xl border border-border bg-card p-3 md:p-4"
      >
        <header className="mb-3 space-y-1 px-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold tracking-tight">{column.title}</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${column.chip}`}
            >
              {laneOrders.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{column.cue}</p>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {laneOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-secondary/40 px-3 py-10 text-center text-sm text-muted-foreground">
              {column.empty}
            </p>
          ) : (
            laneOrders.map((order) => (
              <OrderTicket
                key={order.uuid}
                order={order}
                now={now}
                isNew={flashUuid === order.uuid}
                isAddition={additionUuid === order.uuid}
                isSelected={selectedUuid === order.uuid}
                isUpdating={updatingUuid === order.uuid}
                updatingItemId={
                  updatingUuid === order.uuid ? updatingItemId : null
                }
                errorMessage={ticketErrors[order.uuid] ?? null}
                actionsLocked={actionsLocked}
                advanceLocked={reviewGate?.uuid === order.uuid}
                onAdvance={handleAdvance}
                onCloseAccount={(order) => {
                  if (!actionsLocked) setCloseTarget(order);
                }}
                onItemStatus={handleItemStatus}
                onSelect={(selected) => setSelectedUuid(selected.uuid)}
              />
            ))
          )}
        </div>
      </section>
    );
  }

  const otherColumns = COLUMNS.filter(
    (column) => column.status !== focusStatus,
  );

  function focusColumn(status: OrderStatus) {
    focusTouchedRef.current = true;
    setFocusStatus(status);
  }

  return (
    <div className="flex flex-col pb-8 font-jakarta-sans">
      {/* Solo título + tabs sticky: rail/atajos no consumen viewport en tablet. */}
      <header className="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur-sm md:top-0">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 md:px-6 md:py-2">
          <h1
            className="truncate text-lg font-bold tracking-tight md:text-xl"
            title={restaurantName}
          >
            Cocina
          </h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <KitchenShortcutCheatsheet />
            <AdminConnectionBadge state={connection} compact />
            <span
              className="inline-flex min-h-11 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold tabular-nums"
              aria-label={`${orders.length} comandas activas`}
            >
              {orders.length}
            </span>
          </div>
        </div>

        <AdminRovingTablist
          aria-label="Etapas de cocina"
          className="flex gap-1 overflow-x-auto px-4 pb-2 md:gap-1.5 md:px-6"
        >
          {COLUMNS.map((column, index) => {
            const count = grouped[column.status]?.length ?? 0;
            const overdue = overdueCounts[column.status] ?? 0;
            const selected = column.status === focusStatus;
            return (
              <button
                key={column.status}
                type="button"
                role="tab"
                id={`kitchen-tab-${column.status}`}
                aria-selected={selected}
                aria-controls={LANE_PANEL_ID}
                aria-label={
                  overdue > 0
                    ? `${column.title}, ${count} activas, ${overdue} urgentes`
                    : undefined
                }
                tabIndex={selected ? 0 : -1}
                onClick={() => focusColumn(column.status)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2.5 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:gap-1.5 md:px-3 ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : overdue > 0
                      ? "bg-secondary text-foreground ring-2 ring-destructive/50 hover:bg-secondary/80"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                <span
                  aria-hidden
                  className={`font-mono text-xs font-bold tabular-nums ${
                    selected
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                {column.title}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    selected
                      ? "bg-primary-foreground/20"
                      : column.chip
                  }`}
                >
                  {count}
                </span>
                {overdue > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                      selected
                        ? "bg-primary-foreground/25 text-primary-foreground"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {overdue}
                  </span>
                ) : null}
              </button>
            );
          })}
        </AdminRovingTablist>

        <KitchenShortcutHint />
      </header>

      <div className="space-y-1.5 px-4 pt-2 md:px-6">
        <KitchenStatusRail
          offline={actionsLocked}
          offlineMessage="Sin conexión · no se pueden avanzar ni cobrar hasta reconectar"
          banner={banner}
          reviewOrder={reviewGateOrder}
          oldestOverdue={showUrgentJump ? oldestOverdue : null}
          focusStatus={focusStatus}
          now={now}
          statusUndo={statusUndo}
          undoSecondsLeft={undoSecondsLeft}
          undoDisabled={Boolean(updatingUuid) || closing || actionsLocked}
          onJumpUrgent={jumpToUrgent}
          onReviewed={() => setReviewGate(null)}
          onUndo={() => void handleUndoAdvance()}
        />
      </div>

      <div className="flex-1 px-4 py-3 md:px-6 md:py-4">
        {/* Peek horizontal en md/lg; en xl+ vive el aside. */}
        <div
          className="mb-3 hidden gap-2 overflow-x-auto pb-0.5 md:flex xl:hidden"
          aria-label="Otras etapas"
        >
          {otherColumns.map((column) => (
            <StagePeekCard
              key={column.status}
              compact
              title={column.title}
              cue={column.cue}
              chip={column.chip}
              orders={grouped[column.status] ?? []}
              overdueCount={overdueCounts[column.status] ?? 0}
              now={now}
              onFocus={() => focusColumn(column.status)}
            />
          ))}
        </div>

        <div className="mx-auto grid w-full max-w-2xl gap-4 xl:max-w-6xl xl:grid-cols-[minmax(0,1fr)_minmax(15rem,17.5rem)]">
          <div
            id={LANE_PANEL_ID}
            role="tabpanel"
            aria-labelledby={`kitchen-tab-${focusStatus}`}
          >
            {renderLane(focusStatus, focusOrders)}
          </div>
          <aside
            className="hidden xl:flex xl:flex-col xl:gap-2"
            aria-label="Otras etapas"
          >
            <p className="px-1 text-xs font-semibold text-muted-foreground">
              Otras etapas
            </p>
            {otherColumns.map((column) => (
              <StagePeekCard
                key={column.status}
                title={column.title}
                cue={column.cue}
                chip={column.chip}
                orders={grouped[column.status] ?? []}
                overdueCount={overdueCounts[column.status] ?? 0}
                now={now}
                onFocus={() => focusColumn(column.status)}
              />
            ))}
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(closeTarget)}
        title="¿Cobrar y cerrar cuenta?"
        description={
          closeTarget
            ? closeTarget.orderType === "IN_TABLE"
              ? `Se marcará ${orderWho(closeTarget)} (#${closeTarget.uuid.slice(0, 8).toUpperCase()}) como pagada (${closeTarget.formattedTotal}) y se liberará la mesa.`
              : `Se marcará ${orderWho(closeTarget)} (#${closeTarget.uuid.slice(0, 8).toUpperCase()}) como pagada (${closeTarget.formattedTotal}) y se cerrará la cuenta.`
            : ""
        }
        confirmLabel="Cobrar y cerrar"
        busyLabel="Cerrando…"
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

function StagePeekCard({
  title,
  cue,
  chip,
  orders,
  overdueCount,
  now,
  onFocus,
  compact = false,
}: {
  title: string;
  cue: string;
  chip: string;
  orders: Order[];
  overdueCount: number;
  now: number;
  onFocus: () => void;
  compact?: boolean;
}) {
  const preview = orders.slice(0, compact ? 1 : 2);

  return (
    <button
      type="button"
      onClick={onFocus}
      className={`border border-border bg-card text-left outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        compact
          ? "w-[10rem] shrink-0 rounded-xl p-2.5"
          : "rounded-2xl p-3"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight">{title}</p>
          {!compact ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {cue}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${chip}`}
          >
            {orders.length}
          </span>
          {overdueCount > 0 ? (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold tabular-nums text-destructive">
              {overdueCount} urg
            </span>
          ) : null}
        </div>
      </div>
      {preview.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Sin comandas</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {preview.map((order) => (
            <li
              key={order.uuid}
              className="truncate text-xs font-medium text-foreground"
            >
              <span className="text-muted-foreground">
                {orderAgeMinutes(order, now)}m
              </span>
              {" · "}
              {orderWho(order)}
            </li>
          ))}
          {orders.length > preview.length ? (
            <li className="text-xs text-muted-foreground">
              +{orders.length - preview.length} más
            </li>
          ) : null}
        </ul>
      )}
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-card px-1.5 font-mono text-xs font-semibold leading-none text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {children}
    </kbd>
  );
}

function ShortcutList({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Atajos de teclado"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className ?? ""}`}
    >
      <li className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-0.5">
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <Kbd>3</Kbd>
          <Kbd>4</Kbd>
        </span>
        <span>etapas</span>
      </li>
      <li className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-0.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </span>
        <span aria-hidden className="text-border">
          /
        </span>
        <span className="inline-flex items-center gap-0.5">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
        </span>
        <span>ticket</span>
      </li>
      <li className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Kbd>Enter</Kbd>
        <span>avanzar / cobrar</span>
      </li>
      <li className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Kbd>U</Kbd>
        <span>deshacer</span>
      </li>
    </ul>
  );
}

const SHORTCUT_HINT_KEY = "platolisto.kitchen.shortcutsHint.v1";

/**
 * Atajos: label visible en md+; hint dismissible la primera vez en el turno.
 */
function KitchenShortcutCheatsheet() {
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="kitchen-shortcuts-panel"
        aria-label={
          expanded ? "Ocultar atajos de teclado" : "Mostrar atajos de teclado"
        }
        title="Atajos de teclado"
        onClick={() => setExpanded((open) => !open)}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary px-2.5 text-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:px-3"
      >
        <Keyboard className="size-4 shrink-0" aria-hidden />
        <span className="hidden text-xs font-bold tracking-tight md:inline">
          Atajos
        </span>
      </button>
      {expanded ? (
        <div
          id="kitchen-shortcuts-panel"
          role="region"
          aria-label="Atajos de teclado"
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(calc(100vw-2rem),18rem)] rounded-xl border border-border bg-card p-3 shadow-md"
        >
          <ShortcutList className="flex-col items-start" />
        </div>
      ) : null}
    </div>
  );
}

function KitchenShortcutHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SHORTCUT_HINT_KEY) === "1") return;
      setVisible(true);
    } catch {
      /* private / blocked storage */
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(SHORTCUT_HINT_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div className="flex items-start justify-between gap-3 px-4 pb-2 md:px-6">
      <p className="min-w-0 text-xs leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">Teclado · </span>
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <Kbd>3</Kbd>
          <Kbd>4</Kbd>
          <span>etapas</span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
          <span>ticket</span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Kbd>Enter</Kbd>
          <span>avanzar</span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Kbd>U</Kbd>
          <span>deshacer</span>
        </span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Entendido
      </button>
    </div>
  );
}

type StatusStrip = "offline" | "undo" | "review" | "urgent" | "banner";

/**
 * Prioridad del rail: offline → (undo | review/urgent).
 * Si offline+undo coinciden, el undo se pliega en la franja offline
 * (compacto/deshabilitado) para que review/urgent nunca vayan a overflow.
 */
function KitchenStatusRail({
  offline,
  offlineMessage,
  banner,
  reviewOrder,
  oldestOverdue,
  focusStatus,
  now,
  statusUndo,
  undoSecondsLeft,
  undoDisabled,
  onJumpUrgent,
  onReviewed,
  onUndo,
}: {
  offline: boolean;
  offlineMessage: string;
  banner: string | null;
  reviewOrder: Order | null;
  oldestOverdue: Order | null;
  focusStatus: OrderStatus;
  now: number;
  statusUndo: StatusUndo | null;
  undoSecondsLeft: number;
  undoDisabled: boolean;
  onJumpUrgent: () => void;
  onReviewed: () => void;
  onUndo: () => void;
}) {
  const foldUndoIntoOffline = offline && Boolean(statusUndo);

  const strips: StatusStrip[] = [];
  if (offline) strips.push("offline");
  if (statusUndo && !foldUndoIntoOffline && strips.length < 2) {
    strips.push("undo");
  }

  let secondary: StatusStrip | null = null;
  if (reviewOrder) secondary = "review";
  else if (oldestOverdue) secondary = "urgent";
  else if (banner) secondary = "banner";

  if (secondary && strips.length < 2) {
    strips.push(secondary);
    secondary = null;
  }
  const overflow = secondary;

  if (strips.length === 0 && !overflow) return null;

  function renderStrip(strip: StatusStrip, denser: boolean) {
    const pad = denser ? "px-3 py-2" : "px-4 py-2.5";

    if (strip === "offline") {
      return (
        <div
          key="offline"
          role="alert"
          aria-live="assertive"
          className={`flex flex-wrap items-center justify-center gap-2 rounded-xl border border-warn/40 bg-warn-muted text-sm font-semibold text-warn-ink ${pad} ${
            foldUndoIntoOffline ? "justify-between" : "justify-center text-center"
          }`}
        >
          <p className={foldUndoIntoOffline ? "min-w-0" : undefined}>
            {offlineMessage}
          </p>
          {foldUndoIntoOffline && statusUndo ? (
            <button
              type="button"
              disabled
              title="Sin conexión · no se puede deshacer"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-warn/20 px-3 text-xs font-bold text-warn-ink opacity-80"
            >
              Deshacer
              <span className="tabular-nums">{undoSecondsLeft}s</span>
            </button>
          ) : null}
        </div>
      );
    }

    if (strip === "undo" && statusUndo) {
      return (
        <div
          key="undo"
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/60 text-sm ${pad}`}
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {orderWho(statusUndo.previous)} →{" "}
              {columnTitleFor(statusUndo.toStatus)}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Deshacer ·{" "}
              <span className="font-bold tabular-nums text-foreground">
                {undoSecondsLeft}s
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={undoDisabled}
            title={
              undoDisabled
                ? "Espera a que termine la acción en curso"
                : undefined
            }
            onClick={onUndo}
            className="min-h-11 shrink-0 rounded-xl bg-card px-4 py-2 text-sm font-bold shadow-sm outline-none ring-1 ring-border transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Deshacer
          </button>
        </div>
      );
    }

    if (strip === "review" && reviewOrder) {
      return (
        <div
          key="review"
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn-muted ${pad}`}
        >
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-warn-ink">
              Revisa antes de avanzar
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {orderWho(reviewOrder)} · {columnTitleFor(reviewOrder.status)}
            </p>
          </div>
          <button
            type="button"
            onClick={onReviewed}
            className="min-h-11 shrink-0 rounded-xl bg-warn px-4 py-2 text-sm font-bold text-warn-foreground outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Revisado
          </button>
        </div>
      );
    }

    if (strip === "urgent" && oldestOverdue) {
      return (
        <div
          key="urgent"
          role="status"
          aria-live="polite"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 ${pad}`}
        >
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-destructive">
              Urgente · {orderWho(oldestOverdue)}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {orderAgeMinutes(oldestOverdue, now)} min ·{" "}
              {columnTitleFor(oldestOverdue.status)}
              {focusStatus !== oldestOverdue.status ? " · otra etapa" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onJumpUrgent}
            className="min-h-11 shrink-0 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ir al urgente
          </button>
        </div>
      );
    }

    if (strip === "banner" && banner) {
      return (
        <p
          key="banner"
          role="status"
          aria-live="polite"
          className={`rounded-xl border border-border bg-secondary/50 text-center text-sm font-semibold text-foreground ${pad}`}
        >
          {banner}
        </p>
      );
    }

    return null;
  }

  return (
    <div
      role="region"
      aria-label="Estado de cocina"
      className="flex flex-col gap-1.5"
    >
      {strips.map((strip) => renderStrip(strip, false))}
      {overflow ? (
        <div aria-label="Aviso adicional">{renderStrip(overflow, true)}</div>
      ) : null}
    </div>
  );
}
