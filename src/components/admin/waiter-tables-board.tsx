"use client";

/**
 * Vista del mesero: cuentas abiertas + picker compacto de mesas libres, unión y POS.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronDown, Keyboard, Link2, Plus, Printer, Receipt } from "lucide-react";
import type { Order, OrderStatus, TableCallResponse } from "@/types/api";
import { AdminConnectionBadge } from "@/components/admin/admin-connection-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MergeTablesModal } from "@/components/admin/merge-tables-modal";
import { PreCuentaModal } from "@/components/admin/pre-cuenta-modal";
import type { RestaurantTicketInfo } from "@/lib/ticket-from-order";
import {
  TableCallAlerts,
  type TableCallPrimaryAction,
} from "@/components/admin/table-call-alerts";
import {
  WaiterPosDrawer,
  type WaiterPosLine,
  type WaiterPosOpenAccount,
} from "@/components/admin/waiter-pos-drawer";
import {
  useKitchenOrdersSubscription,
  type KitchenConnectionState,
} from "@/hooks/useKitchenOrdersSubscription";
import { useKitchenAlertSound } from "@/hooks/useKitchenAlertSound";
import {
  closeOrder,
  createStaffOrder,
  mergeTables,
} from "@/services/adminOrderService";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { formatCurrency } from "@/lib/format";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Compact free-table suggestions before “Ver todas” (search is primary). */
const FREE_COMPACT = 4;
/** Ops toast without undo. */
const NOTICE_MS = 8_000;
/** Soft-dismiss Deshacer — long enough for a floor walk. */
const UNDO_NOTICE_MS = 25_000;

function preferScrollBehavior(): ScrollBehavior {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "auto";
  }
  return "smooth";
}

const ACTIVE: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "IN_KITCHEN",
  "DELIVERED",
];

function statusLabel(status: OrderStatus): { label: string; className: string } {
  switch (status) {
    case "PENDING":
      // Quiet — Ticket Amber reserved for table calls only.
      return {
        label: "Pendiente",
        className: "bg-secondary text-muted-foreground ring-1 ring-border",
      };
    case "ACCEPTED":
      return {
        label: "Aceptado",
        className: "bg-secondary text-muted-foreground ring-1 ring-border",
      };
    case "IN_KITCHEN":
      // Weighted neutral ink — cooking signal without competing with calls/Cobrar.
      return {
        label: "En cocina",
        className:
          "bg-foreground/[0.07] text-foreground font-bold ring-1 ring-foreground/40",
      };
    case "DELIVERED":
      return {
        label: "Por cobrar",
        className:
          "bg-live-muted text-live-ink font-semibold ring-1 ring-live/35",
      };
    default:
      return { label: status, className: "bg-secondary text-muted-foreground" };
  }
}

/** Preview corto de líneas: lo que el mesero necesita reconocer sin abrir. */
function summarizeOrderLines(order: Order, maxLines = 2): string {
  if (order.items.length === 0) return "Sin platillos aún";
  const shown = order.items.slice(0, maxLines);
  const parts = shown.map((item) => `${item.quantity}× ${item.productName}`);
  const extra = order.items.length - maxLines;
  if (extra > 0) return `${parts.join(", ")} +${extra}`;
  return parts.join(", ");
}

function formatElapsedShort(iso: string, nowMs: number): string | null {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.floor((nowMs - then) / 60_000));
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

/**
 * Tiempo en el estado actual (usa updatedAt como proxy de último cambio).
 * En cocina / por cobrar llevan la urgencia en el copy.
 */
function statusDurationLabel(
  order: Order,
  nowMs: number,
): string | null {
  const iso = order.updatedAt ?? order.createdAt;
  const elapsed = formatElapsedShort(iso, nowMs);
  if (!elapsed) return null;
  switch (order.status) {
    case "IN_KITCHEN":
      return `${elapsed} en cocina`;
    case "DELIVERED":
      return `${elapsed} por cobrar`;
    case "PENDING":
      return `${elapsed} pendiente`;
    case "ACCEPTED":
      return `${elapsed} aceptado`;
    default:
      return elapsed;
  }
}

function normalizeTableKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/^(mesa\s*)/i, "").trim();
}

function linkedTableKeys(order: Order): string[] | null {
  const primary = normalizeTableKey(order.tableNumber);
  const linked = (order.linkedTables ?? [])
    .map(normalizeTableKey)
    .filter(Boolean);
  if (!primary || linked.length === 0) return null;
  return [primary, ...linked].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true }),
  );
}

function orderTitle(order: Order): string {
  if (order.orderType === "IN_TABLE") {
    const linked = linkedTableKeys(order);
    if (linked) return `Mesa ${linked.join("-")}`;
    return order.tableNumber?.trim()
      ? `Mesa ${normalizeTableKey(order.tableNumber)}`
      : "Mesa sin número";
  }
  if (order.orderType === "PICKUP") {
    return order.customerName?.trim() || "Para llevar";
  }
  if (order.orderType === "DELIVERY") {
    return order.customerName?.trim() || "A domicilio";
  }
  return `#${order.uuid.slice(0, 8).toUpperCase()}`;
}

/** Channel lane label — Attention ≠ Channel (never Ticket Amber). */
function channelTypeLabel(order: Order): string | null {
  if (order.orderType === "PICKUP") return "Para llevar";
  if (order.orderType === "DELIVERY") return "A domicilio";
  return null;
}

function attentionRank(order: Order, callTableKeys: Set<string>): number {
  if (order.orderType === "IN_TABLE" && callTableKeys.size > 0) {
    const primary = normalizeTableKey(order.tableNumber);
    const hit =
      (primary && callTableKeys.has(primary)) ||
      (order.linkedTables ?? []).some((t) =>
        callTableKeys.has(normalizeTableKey(t)),
      );
    if (hit) return 0;
  }
  switch (order.status) {
    case "DELIVERED":
      return 1;
    case "IN_KITCHEN":
      return 2;
    case "ACCEPTED":
      return 3;
    case "PENDING":
      return 4;
    default:
      return 5;
  }
}

function compareAccounts(
  a: Order,
  b: Order,
  callTableKeys: Set<string>,
): number {
  const rank = attentionRank(a, callTableKeys) - attentionRank(b, callTableKeys);
  if (rank !== 0) return rank;
  const aTable = a.tableNumber ?? "";
  const bTable = b.tableNumber ?? "";
  if (aTable && bTable) {
    return aTable.localeCompare(bTable, "es", { numeric: true });
  }
  return (
    new Date(b.updatedAt ?? b.createdAt).getTime() -
    new Date(a.updatedAt ?? a.createdAt).getTime()
  );
}

interface PosTarget {
  tableNumber: string;
  activeOrderUuid: string | null;
}

interface WaiterTablesBoardProps {
  tenantSlug: string;
  restaurantName: string;
  initialOrders: Order[];
  /** Total de mesas del salón (configurado en settings). */
  floorSize: number;
  /** Datos de marca para el ticket (nombre, dirección, WhatsApp). */
  restaurantInfo?: RestaurantTicketInfo;
  /** Enlace a historial de pedidos (admin/owner). */
  historyHref?: string | null;
}

export function WaiterTablesBoard({
  tenantSlug,
  restaurantName,
  initialOrders,
  floorSize,
  restaurantInfo,
  historyHref = null,
}: WaiterTablesBoardProps) {
  const ticketRestaurant: RestaurantTicketInfo = restaurantInfo ?? {
    name: restaurantName,
  };
  const [orders, setOrders] = useState(() =>
    initialOrders.filter((o) => ACTIVE.includes(o.status)),
  );
  const [connection, setConnection] =
    useState<KitchenConnectionState>("connecting");
  const [closeTarget, setCloseTarget] = useState<Order | null>(null);
  const [preCuentaOrder, setPreCuentaOrder] = useState<Order | null>(null);
  const [preCuentaKind, setPreCuentaKind] = useState<"pre-cuenta" | "cuenta">(
    "pre-cuenta",
  );
  const [closeError, setCloseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableCalls, setTableCalls] = useState<TableCallResponse[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [dismissCallTarget, setDismissCallTarget] =
    useState<TableCallResponse | null>(null);
  const [dismissClearableOpen, setDismissClearableOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [posTarget, setPosTarget] = useState<PosTarget | null>(null);
  const [freePickerOpen, setFreePickerOpen] = useState(false);
  const [freeTableQuery, setFreeTableQuery] = useState("");
  const [freeWallExpanded, setFreeWallExpanded] = useState(false);
  const freeSearchRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"live" | "neutral">("neutral");
  const [undoCall, setUndoCall] = useState<TableCallResponse | null>(null);
  const [undoCallsBatch, setUndoCallsBatch] = useState<
    TableCallResponse[] | null
  >(null);
  const [armedCallId, setArmedCallId] = useState<string | null>(null);
  const [focusOrderUuid, setFocusOrderUuid] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedCallIdRef = useRef<string | null>(null);
  const hasUndoNoticeRef = useRef(false);
  const freePickerOpenRef = useRef(false);
  const playAlertCue = useKitchenAlertSound();

  useEffect(() => {
    const ms = tableCalls.length > 0 ? 15_000 : 30_000;
    const id = window.setInterval(() => setNowMs(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [tableCalls.length]);

  useEffect(() => {
    armedCallIdRef.current = armedCallId;
  }, [armedCallId]);

  useEffect(() => {
    freePickerOpenRef.current = freePickerOpen;
  }, [freePickerOpen]);

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
  }, []);

  const showNotice = useCallback(
    (
      message: string,
      options?: {
        undoCall?: TableCallResponse | null;
        undoCalls?: TableCallResponse[] | null;
        /** live = money success only; default neutral for ops. */
        tone?: "live" | "neutral";
      },
    ) => {
      clearNoticeTimer();
      setNotice(message);
      setNoticeTone(options?.tone ?? "neutral");
      setUndoCall(options?.undoCall ?? null);
      setUndoCallsBatch(options?.undoCalls ?? null);
      const hasUndo = Boolean(
        options?.undoCall ||
          (options?.undoCalls && options.undoCalls.length > 0),
      );
      hasUndoNoticeRef.current = hasUndo;
      noticeTimerRef.current = setTimeout(() => {
        setNotice((current) => (current === message ? null : current));
        setUndoCall(null);
        setUndoCallsBatch(null);
        hasUndoNoticeRef.current = false;
        noticeTimerRef.current = null;
      }, hasUndo ? UNDO_NOTICE_MS : NOTICE_MS);
    },
    [clearNoticeTimer],
  );

  function dismissNotice() {
    clearNoticeTimer();
    setNotice(null);
    setNoticeTone("neutral");
    setUndoCall(null);
    setUndoCallsBatch(null);
    hasUndoNoticeRef.current = false;
  }

  function restoreUndoneCall() {
    if (undoCallsBatch && undoCallsBatch.length > 0) {
      const batch = undoCallsBatch;
      setTableCalls((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        const restored = batch.filter((c) => !ids.has(c.id));
        return [...restored, ...prev].slice(0, 12);
      });
      dismissNotice();
      showNotice(
        batch.length === 1
          ? `Aviso restaurado · Mesa ${normalizeTableKey(batch[0].tableNumber) || batch[0].tableNumber}`
          : `Avisos restaurados · ${batch.length}`,
      );
      return;
    }
    if (!undoCall) return;
    const call = undoCall;
    setTableCalls((prev) => {
      const without = prev.filter((c) => c.id !== call.id);
      return [call, ...without].slice(0, 12);
    });
    dismissNotice();
    showNotice(
      `Aviso restaurado · Mesa ${normalizeTableKey(call.tableNumber) || call.tableNumber}`,
    );
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    };
  }, []);

  const onOrderEvent = useCallback((order: Order) => {
    setOrders((prev) => {
      const without = prev.filter((o) => o.uuid !== order.uuid);
      if (!ACTIVE.includes(order.status)) return without;
      return [order, ...without].sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() -
          new Date(a.updatedAt ?? a.createdAt).getTime(),
      );
    });
  }, []);

  const onTableCall = useCallback(
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
    onOrderEvent,
    onTableCall,
    onConnectionChange: setConnection,
  });

  const callTableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const call of tableCalls) {
      const key = normalizeTableKey(call.tableNumber);
      if (key) keys.add(key);
    }
    return keys;
  }, [tableCalls]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => compareAccounts(a, b, callTableKeys)),
    [orders, callTableKeys],
  );

  const floorAccounts = useMemo(
    () => sorted.filter((o) => o.orderType === "IN_TABLE"),
    [sorted],
  );

  const channelAccounts = useMemo(
    () => sorted.filter((o) => o.orderType !== "IN_TABLE"),
    [sorted],
  );

  const occupiedTableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const order of orders) {
      if (order.orderType !== "IN_TABLE") continue;
      const primary = normalizeTableKey(order.tableNumber);
      if (primary) keys.add(primary);
      for (const linked of order.linkedTables ?? []) {
        const t = normalizeTableKey(linked);
        if (t) keys.add(t);
      }
    }
    return keys;
  }, [orders]);

  const freeTables = useMemo(() => {
    const free: string[] = [];
    for (let i = 1; i <= floorSize; i += 1) {
      const key = String(i);
      if (!occupiedTableKeys.has(key)) free.push(key);
    }
    return free;
  }, [floorSize, occupiedTableKeys]);

  const visibleFreeTables = useMemo(() => {
    const raw = freeTableQuery.trim();
    const q = raw.toLowerCase();
    if (!q) return freeTables;
    // Digit entry: exact mesa wins alone (rush path).
    const exact = freeTables.filter(
      (table) => table === raw || table.toLowerCase() === q,
    );
    if (exact.length === 1) return exact;
    return freeTables.filter(
      (table) => table.includes(q) || `mesa ${table}`.includes(q),
    );
  }, [freeTables, freeTableQuery]);

  const showFreeFilter = freeTables.length >= 4;
  const freeIsFiltered = Boolean(freeTableQuery.trim());
  const freeNeedsCompact =
    !freeIsFiltered &&
    !freeWallExpanded &&
    visibleFreeTables.length > FREE_COMPACT;
  const displayedFreeTables = freeNeedsCompact
    ? visibleFreeTables.slice(0, FREE_COMPACT)
    : visibleFreeTables;
  const hiddenFreeCount = freeNeedsCompact
    ? visibleFreeTables.length - FREE_COMPACT
    : 0;

  /** Decade zones only on the full unfiltered wall. */
  const freeTableZones = useMemo(() => {
    const useZones =
      freeWallExpanded &&
      !freeIsFiltered &&
      displayedFreeTables.length >= 12;
    if (!useZones) {
      return [{ label: null as string | null, tables: displayedFreeTables }];
    }
    const zones: { label: string | null; tables: string[] }[] = [];
    for (const table of displayedFreeTables) {
      const n = Number.parseInt(table, 10);
      const start = Number.isFinite(n) ? Math.floor((n - 1) / 10) * 10 + 1 : 1;
      const end = start + 9;
      const label = `${start}–${end}`;
      const last = zones[zones.length - 1];
      if (last && last.label === label) last.tables.push(table);
      else zones.push({ label, tables: [table] });
    }
    return zones;
  }, [
    displayedFreeTables,
    freeIsFiltered,
    freeWallExpanded,
  ]);

  const canMerge = occupiedTableKeys.size >= 2;

  const posOpenAccount = useMemo((): WaiterPosOpenAccount | null => {
    if (!posTarget?.activeOrderUuid) return null;
    const order = orders.find((o) => o.uuid === posTarget.activeOrderUuid);
    if (!order) return null;
    return {
      statusLabel: statusLabel(order.status).label,
      formattedTotal: order.formattedTotal || formatCurrency(order.totalAmount),
      items: order.items.map((item) => ({
        quantity: item.quantity,
        productName: item.productName,
      })),
    };
  }, [orders, posTarget]);

  async function confirmClose() {
    if (!closeTarget || busy) return;
    const closing = closeTarget;
    setBusy(true);
    setCloseError(null);
    try {
      const closed = await closeOrder(closing.uuid, tenantSlug);
      setOrders((prev) => prev.filter((o) => o.uuid !== closed.uuid));
      const freedKeys = new Set<string>();
      const primary = normalizeTableKey(closing.tableNumber);
      if (primary) freedKeys.add(primary);
      for (const linked of closing.linkedTables ?? []) {
        const key = normalizeTableKey(linked);
        if (key) freedKeys.add(key);
      }
      setTableCalls((prev) =>
        prev.filter((call) => {
          if (activeCallId && call.id === activeCallId) return false;
          if (freedKeys.size === 0) return true;
          return !freedKeys.has(normalizeTableKey(call.tableNumber));
        }),
      );
      setActiveCallId(null);
      setCloseTarget(null);
      setCloseError(null);
      showNotice(`Cuenta cobrada · ${orderTitle(closing)}`, { tone: "live" });
    } catch (err) {
      setCloseError(
        getAdminErrorMessage(err, "No se pudo cobrar la cuenta. Revisa la conexión e inténtalo de nuevo."),
      );
    } finally {
      setBusy(false);
    }
  }

  function findCallForOrder(order: Order): TableCallResponse | undefined {
    if (order.orderType !== "IN_TABLE") return undefined;
    const keys = new Set<string>();
    const primary = normalizeTableKey(order.tableNumber);
    if (primary) keys.add(primary);
    for (const linked of order.linkedTables ?? []) {
      const key = normalizeTableKey(linked);
      if (key) keys.add(key);
    }
    if (keys.size === 0) return undefined;
    return tableCalls.find((call) =>
      keys.has(normalizeTableKey(call.tableNumber)),
    );
  }

  function openCloseDialog(order: Order) {
    if (order.status !== "DELIVERED") return;
    const call = findCallForOrder(order);
    if (call && !parkCallAction(call.id)) return;
    setError(null);
    setCloseError(null);
    setCloseTarget(order);
  }

  function cancelCloseDialog() {
    if (busy) return;
    setCloseTarget(null);
    setCloseError(null);
    setActiveCallId(null);
  }

  async function confirmMerge(primary: string, secondaries: string[]) {
    setBusy(true);
    setMergeError(null);
    setError(null);
    try {
      const merged = await mergeTables(
        { primaryTable: primary, secondaryTables: secondaries },
        tenantSlug,
      );
      setOrders((prev) => {
        const absorbed = new Set(secondaries.map(normalizeTableKey));
        const withoutSecondaries = prev.filter((o) => {
          if (o.uuid === merged.uuid) return false;
          const t = normalizeTableKey(o.tableNumber);
          return !t || !absorbed.has(t);
        });
        return [merged, ...withoutSecondaries];
      });
      setMergeOpen(false);
      const joined = [primary, ...secondaries]
        .map(normalizeTableKey)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
      showNotice(`Mesas unidas · Mesa ${joined.join("-")}`);
    } catch (err) {
      setMergeError(getAdminErrorMessage(err, "No se pudieron unir las mesas."));
    } finally {
      setBusy(false);
    }
  }

  async function submitPos(lines: WaiterPosLine[]) {
    if (!posTarget) return;
    const target = posTarget;
    const wasAddition = Boolean(target.activeOrderUuid);
    const callId = activeCallId;
    setBusy(true);
    try {
      const order = await createStaffOrder(
        {
          tableNumber: target.tableNumber,
          activeOrderUuid: target.activeOrderUuid,
          customerName: `Mesa ${target.tableNumber}`,
          details: lines.map((line) => ({
            productUuid: line.productUuid,
            quantity: line.quantity,
            notes: line.notes,
            modifierUuids: line.modifierUuids,
          })),
        },
        tenantSlug,
      );
      setOrders((prev) => {
        const without = prev.filter((o) => o.uuid !== order.uuid);
        return [order, ...without];
      });
      setPosTarget(null);
      if (callId) {
        setTableCalls((prev) => prev.filter((call) => call.id !== callId));
        setActiveCallId(null);
      }
      showNotice(
        wasAddition
          ? `Adición enviada · Mesa ${target.tableNumber}`
          : `Comanda enviada · Mesa ${target.tableNumber}`,
      );
    } finally {
      // Failures rethrow to WaiterPosDrawer submitError (not the board strip under z-80).
      setBusy(false);
    }
  }

  function openPosForOrder(order: Order) {
    const table = normalizeTableKey(order.tableNumber);
    if (!table) {
      setError("Esta cuenta no tiene número de mesa.");
      return;
    }
    const call = findCallForOrder(order);
    if (call && !parkCallAction(call.id)) return;
    setError(null);
    setPosTarget({ tableNumber: table, activeOrderUuid: order.uuid });
  }

  function openPosForFreeTable(table: string) {
    setError(null);
    setFreePickerOpen(false);
    setPosTarget({ tableNumber: table, activeOrderUuid: null });
  }

  function findOrderForTable(tableNumber: string): Order | undefined {
    const key = normalizeTableKey(tableNumber);
    if (!key) return undefined;
    return orders.find((order) => {
      if (order.orderType !== "IN_TABLE") return false;
      if (normalizeTableKey(order.tableNumber) === key) return true;
      return (order.linkedTables ?? []).some(
        (linked) => normalizeTableKey(linked) === key,
      );
    });
  }

  function focusAccountCard(orderUuid: string) {
    setFocusOrderUuid(orderUuid);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    requestAnimationFrame(() => {
      document
        .getElementById(`account-${orderUuid}`)
        ?.scrollIntoView({
          behavior: preferScrollBehavior(),
          block: "center",
        });
    });
    focusTimerRef.current = setTimeout(() => {
      setFocusOrderUuid((current) =>
        current === orderUuid ? null : current,
      );
      focusTimerRef.current = null;
    }, 2600);
  }

  /**
   * First press arms+flashes the aviso; second press within 2.5s fires CTA.
   * Sole clearable aviso → fire immediately (matches touch primary).
   */
  function armOrFireCall(call: TableCallResponse) {
    const clearable = tableCalls.filter((c) => c.id !== activeCallId);
    const soleClearable =
      clearable.length === 1 && clearable[0]?.id === call.id;

    if (armedCallId === call.id || soleClearable) {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
      setArmedCallId(null);
      handleCallPrimaryAction(call);
      return;
    }
    setArmedCallId(call.id);
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    requestAnimationFrame(() => {
      document
        .getElementById(`call-alert-${call.id}`)
        ?.scrollIntoView({
          behavior: preferScrollBehavior(),
          block: "nearest",
        });
    });
    armTimerRef.current = setTimeout(() => {
      armTimerRef.current = null;
      if (armedCallIdRef.current !== call.id) return;
      setArmedCallId(null);
      showNotice("Aviso desarmado · Enter otra vez para armar");
    }, 2500);
  }

  function getCallPrimaryAction(
    call: TableCallResponse,
  ): TableCallPrimaryAction | null {
    const order = findOrderForTable(call.tableNumber);
    if (call.callType === "BILL" && order?.status === "DELIVERED") {
      return { label: "Cobrar", tone: "live" };
    }
    if (call.callType === "BILL" && order) {
      return { label: "Ticket" };
    }
    if (order) {
      return {
        label: call.callType === "WAITER" ? "Adición" : "Ir a mesa",
      };
    }
    return { label: "Abrir mesa" };
  }

  /** Park a call in Cobrar/POS without dismissing it; release any prior dialog. */
  function parkCallAction(callId: string) {
    if (busy) return false;
    setCloseTarget(null);
    setCloseError(null);
    setPosTarget(null);
    setActiveCallId(callId);
    return true;
  }

  /** Soft-dismiss a call with Deshacer — WAITER X / Limpiar solo WAITER. Never BILL. */
  function softDismissCall(call: TableCallResponse) {
    setTableCalls((prev) => prev.filter((item) => item.id !== call.id));
    if (activeCallId === call.id) setActiveCallId(null);
    if (armedCallId === call.id) {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
      setArmedCallId(null);
    }
    const mesa = normalizeTableKey(call.tableNumber) || call.tableNumber;
    showNotice(`Aviso de Mesa ${mesa} quitado`, { undoCall: call });
  }

  function handleCallPrimaryAction(call: TableCallResponse) {
    const order = findOrderForTable(call.tableNumber);
    if (call.callType === "BILL" && order?.status === "DELIVERED") {
      // openCloseDialog parks the matching call.
      openCloseDialog(order);
      return;
    }
    if (call.callType === "BILL" && order) {
      // Park + open pre-cuenta — keep the money signal until Cobrar or discard.
      if (!parkCallAction(call.id)) return;
      focusAccountCard(order.uuid);
      setPreCuentaKind("pre-cuenta");
      setPreCuentaOrder(order);
      return;
    }
    if (order) {
      if (call.callType === "WAITER") {
        // openPosForOrder parks the matching call.
        openPosForOrder(order);
        return;
      }
      // Non-BILL navigation: soft-dismiss + undo.
      softDismissCall(call);
      focusAccountCard(order.uuid);
      return;
    }
    const table = normalizeTableKey(call.tableNumber);
    if (table) {
      if (!parkCallAction(call.id)) return;
      openPosForFreeTable(table);
    }
  }

  const showFreePicker =
    freeTables.length > 0 && (freePickerOpen || sorted.length === 0);
  const callsActive = tableCalls.length > 0;
  const prevCallsLenRef = useRef(0);

  // Quieter: when new avisos land, collapse the free picker so attention owns the stage.
  // Harden: a new aviso also drops pending Deshacer (stale after the next interrupt).
  // Clarify: if the picker was open, say why it closed and how to reopen (digits kept).
  useEffect(() => {
    const len = tableCalls.length;
    if (len > prevCallsLenRef.current) {
      const wasPickerOpen = freePickerOpenRef.current;
      setFreePickerOpen(false);
      if (hasUndoNoticeRef.current) {
        clearNoticeTimer();
        setNotice(null);
        setNoticeTone("neutral");
        setUndoCall(null);
        setUndoCallsBatch(null);
        hasUndoNoticeRef.current = false;
      } else if (wasPickerOpen) {
        showNotice(
          "Avisos nuevos · mesas libres cerradas · N para reabrir",
        );
      }
    }
    prevCallsLenRef.current = len;
  }, [tableCalls.length, clearNoticeTimer, showNotice]);

  useEffect(() => {
    if (showFreePicker) return;
    // Keep search digits after auto-collapse; intentional close clears them.
    setFreeWallExpanded(false);
  }, [showFreePicker]);

  useEffect(() => {
    if (!showFreePicker || !showFreeFilter) return;
    // Don't steal Enter/C from avisos while calls are active.
    if (callsActive) return;
    const id = window.requestAnimationFrame(() => {
      freeSearchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [showFreePicker, showFreeFilter, callsActive]);

  const boardChromeBlocked =
    busy ||
    !!posTarget ||
    !!closeTarget ||
    mergeOpen ||
    !!dismissCallTarget ||
    dismissClearableOpen;

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true;
      }
      return target.isContentEditable;
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "Escape") {
        if (boardChromeBlocked) return;
        if (freePickerOpen && sorted.length > 0) {
          e.preventDefault();
          setFreePickerOpen(false);
          setFreeTableQuery("");
          setFreeWallExpanded(false);
        }
        return;
      }

      if (boardChromeBlocked) return;

      // Don't steal Enter/letters from focused controls.
      if (
        e.target instanceof HTMLElement &&
        e.target.closest(
          "button, a, [role='button'], [role='dialog'], [role='menuitem']",
        )
      ) {
        return;
      }

      if (
        e.key === "/" &&
        showFreePicker &&
        showFreeFilter
      ) {
        e.preventDefault();
        freeSearchRef.current?.focus();
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (key === "n" && freeTables.length > 0 && sorted.length > 0) {
        e.preventDefault();
        setFreePickerOpen((open) => !open);
        return;
      }

      if (key === "c") {
        const focused = focusOrderUuid
          ? orders.find((o) => o.uuid === focusOrderUuid)
          : undefined;
        if (focused?.status === "DELIVERED") {
          e.preventDefault();
          openCloseDialog(focused);
          return;
        }
        const nextBill = tableCalls.find((call) => {
          if (call.id === activeCallId || call.callType !== "BILL") {
            return false;
          }
          return findOrderForTable(call.tableNumber)?.status === "DELIVERED";
        });
        if (nextBill) {
          e.preventDefault();
          armOrFireCall(nextBill);
        }
        return;
      }

      if (e.key === "Enter") {
        const next = tableCalls.find((call) => call.id !== activeCallId);
        if (!next) return;
        e.preventDefault();
        armOrFireCall(next);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeCallId,
    armedCallId,
    boardChromeBlocked,
    focusOrderUuid,
    freePickerOpen,
    freeTables.length,
    orders,
    showFreeFilter,
    showFreePicker,
    sorted.length,
    tableCalls,
  ]);

  function renderAccountCard(order: Order) {
    const badge = statusLabel(order.status);
    const linePreview = summarizeOrderLines(order);
    const duration = statusDurationLabel(order, nowMs);
    const tableKey = normalizeTableKey(order.tableNumber);
    const linked = linkedTableKeys(order);
    const callKeys = new Set<string>();
    if (tableKey) callKeys.add(tableKey);
    for (const key of order.linkedTables ?? []) {
      const normalized = normalizeTableKey(key);
      if (normalized) callKeys.add(normalized);
    }
    const hasCall =
      order.orderType === "IN_TABLE" &&
      callKeys.size > 0 &&
      tableCalls.some((c) =>
        callKeys.has(normalizeTableKey(c.tableNumber)),
      );
    const linkedCall = hasCall
      ? tableCalls.find((c) =>
          callKeys.has(normalizeTableKey(c.tableNumber)),
        )
      : undefined;
    /** Ownership mark — chip, not amber card wash; alerts stay the loud interrupt. */
    const callCue =
      linkedCall?.callType === "BILL"
        ? "Piden la cuenta"
        : linkedCall
          ? "Te llaman"
          : null;
    const CallCueIcon =
      linkedCall?.callType === "BILL" ? Receipt : Bell;
    const channel = channelTypeLabel(order);
    const canCharge = order.status === "DELIVERED";
    /** Distill: BILL aviso owns Cobrar — hide the card twin so alerts are the money door. */
    const showCardCharge =
      canCharge && linkedCall?.callType !== "BILL";
    const attendant =
      order.staffName?.trim() ||
      (order.orderType === "IN_TABLE" && order.customerName?.trim()
        ? order.customerName.trim()
        : null);
    // Wait duration only when no call interrupt (alerts own attention).
    const emphasizeWait =
      !hasCall &&
      (order.status === "IN_KITCHEN" || order.status === "DELIVERED");
    const focused = focusOrderUuid === order.uuid;

    const metaBits: string[] = [];
    if (linked) metaBits.push("Unidas");
    if (duration) metaBits.push(duration);
    if (attendant) {
      metaBits.push(
        order.staffName?.trim()
          ? `Atendido por ${attendant}`
          : attendant,
      );
    }

    return (
      <li
        key={order.uuid}
        id={`account-${order.uuid}`}
        onClick={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.closest("button, a, input, label")
          ) {
            return;
          }
          focusAccountCard(order.uuid);
        }}
        className={`flex flex-col rounded-2xl border bg-card p-4 transition-[box-shadow,border-color] ${
          focused
            ? "border-foreground/45 ring-1 ring-foreground/20"
            : channel
              ? "border-channel/65"
              : "border-border"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold tracking-tight">
              {orderTitle(order)}
            </p>
            {callCue ? (
              <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-warn-muted px-2 py-0.5 text-xs font-semibold text-warn-ink">
                <CallCueIcon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{callCue}</span>
              </p>
            ) : channel && orderTitle(order) !== channel ? (
              <p className="mt-1 text-xs font-semibold text-channel-ink">
                {channel}
              </p>
            ) : null}
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {linePreview}
            </p>
            {metaBits.length > 0 ? (
              <p
                className={`mt-1 text-xs ${
                  emphasizeWait
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {metaBits.join(" · ")}
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <p className="mt-3 text-base font-semibold tabular-nums tracking-tight text-foreground">
          {order.formattedTotal || formatCurrency(order.totalAmount)}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <div
            className={`grid gap-2 ${
              order.orderType === "IN_TABLE" ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setPreCuentaKind("pre-cuenta");
                setPreCuentaOrder(order);
              }}
              title="Imprimir o enviar pre-cuenta"
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold ${focusRing}`}
            >
              <Printer className="size-4" aria-hidden />
              Ticket
            </button>
            {order.orderType === "IN_TABLE" ? (
              <button
                type="button"
                onClick={() => openPosForOrder(order)}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing}`}
              >
                <Plus className="size-4" aria-hidden />
                Adición
              </button>
            ) : null}
          </div>
          {showCardCharge ? (
            <button
              type="button"
              onClick={() => openCloseDialog(order)}
              title="Cierra la cuenta y libera la mesa"
              className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-live px-3 text-sm font-bold text-live-foreground ${focusRing}`}
            >
              <Receipt className="size-4" aria-hidden />
              Cobrar
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Salón
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {restaurantName} · cuentas abiertas del turno
          </p>
          {armedCallId ? (
            <p
              className="mt-1 text-xs font-semibold text-warn-ink"
              aria-live="polite"
            >
              Aviso listo · Enter o C otra vez
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminConnectionBadge state={connection} />
          <WaiterShortcutCheatsheet />
          {historyHref ? (
            <a
              href={historyHref}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold ${focusRing}`}
            >
              Historial
            </a>
          ) : null}
          <button
            type="button"
            disabled={freeTables.length === 0}
            aria-expanded={showFreePicker}
            aria-controls={showFreePicker ? "free-tables-picker" : undefined}
            title={
              freeTables.length === 0
                ? "Todas las mesas tienen cuenta abierta"
                : "Abrir pedido en mesa libre"
            }
            onClick={() => {
              if (sorted.length === 0) return;
              if (freePickerOpen) {
                setFreeTableQuery("");
                setFreeWallExpanded(false);
              }
              setFreePickerOpen((open) => !open);
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            <Plus className="size-4" aria-hidden />
            Nueva mesa
            {sorted.length > 0 ? (
              <ChevronDown
                className={`size-4 transition-transform ${showFreePicker ? "rotate-180" : ""}`}
                aria-hidden
              />
            ) : null}
          </button>
          <button
            type="button"
            disabled={!canMerge}
            title={
              canMerge
                ? "Une mesas para que compartan una sola cuenta"
                : "Necesitas al menos dos mesas con cuenta para unir"
            }
            onClick={() => {
              setMergeError(null);
              setMergeOpen(true);
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            <Link2 className="size-4" aria-hidden />
            Unir
          </button>
        </div>
      </header>

      <TableCallAlerts
        calls={tableCalls}
        inProgressCallId={activeCallId}
        nowMs={nowMs}
        highlightedCallId={armedCallId}
        onDismiss={(id) => {
          if (activeCallId === id) return;
          const call = tableCalls.find((c) => c.id === id);
          if (!call) return;
          if (call.callType === "BILL") {
            setDismissClearableOpen(false);
            setDismissCallTarget(call);
            return;
          }
          // WAITER (and other non-BILL): soft-dismiss + Deshacer.
          softDismissCall(call);
        }}
        onDismissAll={() => {
          const clearable = tableCalls.filter((c) => c.id !== activeCallId);
          if (clearable.length === 0) return;
          if (clearable.some((c) => c.callType === "BILL")) {
            setDismissCallTarget(null);
            setDismissClearableOpen(true);
            return;
          }
          // WAITER-only stack: soft-clear + bulk Deshacer.
          setTableCalls((prev) =>
            activeCallId
              ? prev.filter((c) => c.id === activeCallId)
              : [],
          );
          if (armTimerRef.current) clearTimeout(armTimerRef.current);
          armTimerRef.current = null;
          setArmedCallId(null);
          showNotice(
            clearable.length === 1
              ? `Aviso quitado · Mesa ${normalizeTableKey(clearable[0].tableNumber) || clearable[0].tableNumber}`
              : `Avisos quitados · ${clearable.length}`,
            { undoCalls: clearable },
          );
        }}
        getPrimaryAction={getCallPrimaryAction}
        onPrimaryAction={(call) => {
          if (armTimerRef.current) clearTimeout(armTimerRef.current);
          armTimerRef.current = null;
          setArmedCallId(null);
          handleCallPrimaryAction(call);
        }}
      />

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-2 text-xs ${
            noticeTone === "live"
              ? "rounded-lg border border-live/25 bg-live-muted/70 px-3 py-2 font-medium text-live-ink"
              : undoCall || (undoCallsBatch && undoCallsBatch.length > 0)
                ? "rounded-lg border border-border bg-secondary/70 px-3 py-2 font-medium text-foreground"
                : "px-1 py-1.5 font-medium text-muted-foreground"
          }`}
        >
          <p className="min-w-0 flex-1">{notice}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {undoCall || (undoCallsBatch && undoCallsBatch.length > 0) ? (
              <button
                type="button"
                onClick={restoreUndoneCall}
                className={`inline-flex min-h-9 items-center rounded-lg px-2.5 font-bold underline-offset-2 hover:bg-background/60 hover:underline ${focusRing}`}
              >
                Deshacer
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismissNotice}
              className={`inline-flex min-h-9 items-center rounded-lg px-2.5 underline-offset-2 hover:underline ${focusRing}`}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {error && !posTarget ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className={`shrink-0 text-xs font-semibold underline-offset-2 hover:underline ${focusRing}`}
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {showFreePicker ? (
        <div
          id="free-tables-picker"
          role="region"
          aria-label="Mesas libres"
          className="rounded-2xl border border-border bg-card px-4 py-3"
        >
          <p className="text-sm font-semibold text-foreground">
            Mesa libre
            <span className="ml-2 font-normal text-muted-foreground">
              {freeTables.length} disponible
              {freeTables.length === 1 ? "" : "s"}
            </span>
          </p>
          {showFreeFilter ? (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Escribe el número de mesa
              </span>
              <input
                ref={freeSearchRef}
                type="search"
                inputMode="numeric"
                enterKeyHint="go"
                autoComplete="off"
                placeholder="Ej. 12 · Enter abre · (/)"
                value={freeTableQuery}
                onChange={(e) => {
                  setFreeTableQuery(e.target.value);
                  setFreeWallExpanded(false);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const match = visibleFreeTables[0];
                  if (!match) return;
                  e.preventDefault();
                  openPosForFreeTable(match);
                }}
                className={`w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base tabular-nums font-semibold ${focusRing}`}
              />
            </label>
          ) : null}
          {freeNeedsCompact ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sugeridas {FREE_COMPACT} · mejor escribe el número
            </p>
          ) : freeIsFiltered && visibleFreeTables.length === 1 ? (
            <p className="mt-2 text-xs font-medium text-foreground">
              Enter abre Mesa {visibleFreeTables[0]}
            </p>
          ) : null}
          <ul className="mt-3 max-h-[min(28dvh,12rem)] space-y-3 overflow-y-auto">
            {freeTableZones.map((zone) => (
              <li key={zone.label ?? "all"} className="list-none">
                {zone.label ? (
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    Mesas {zone.label}
                  </p>
                ) : null}
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {zone.tables.map((table) => (
                    <li key={`free-${table}`}>
                      <button
                        type="button"
                        onClick={() => openPosForFreeTable(table)}
                        className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-2 text-sm font-bold tabular-nums hover:border-foreground hover:bg-secondary ${focusRing}`}
                      >
                        <span className="sr-only">Tomar pedido en mesa </span>
                        {table}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {hiddenFreeCount > 0 ? (
            <button
              type="button"
              onClick={() => setFreeWallExpanded(true)}
              className={`mt-2 text-xs font-semibold text-foreground underline-offset-2 hover:underline ${focusRing}`}
            >
              Ver las {hiddenFreeCount} restantes
            </button>
          ) : null}
          {freeWallExpanded &&
          !freeIsFiltered &&
          visibleFreeTables.length > FREE_COMPACT ? (
            <button
              type="button"
              onClick={() => setFreeWallExpanded(false)}
              className={`mt-2 block text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline ${focusRing}`}
            >
              Mostrar solo las próximas {FREE_COMPACT}
            </button>
          ) : null}
          {visibleFreeTables.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Ninguna mesa coincide con “{freeTableQuery.trim()}”.
            </p>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Mesas
          </h2>
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-lg font-semibold">No hay cuentas abiertas</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {freeTables.length > 0
                ? "Elige una mesa libre arriba o espera el QR del comensal."
                : "Todas las mesas tienen cuenta abierta. Espera el QR o cobra una mesa lista."}
            </p>
          </div>
        </section>
      ) : (
        <>
          {floorAccounts.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Mesas
                <span className="ml-2 font-semibold normal-case tracking-normal tabular-nums text-foreground">
                  {floorAccounts.length}
                </span>
              </h2>
              <p className="mb-3 -mt-2 text-xs text-muted-foreground">
                Primero las que te llaman o están listas para cobrar
              </p>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {floorAccounts.map((order) => renderAccountCard(order))}
              </ul>
            </section>
          ) : null}

          {channelAccounts.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-channel-ink">
                Para llevar y domicilio
                <span className="ml-2 font-semibold normal-case tracking-normal tabular-nums text-foreground">
                  {channelAccounts.length}
                </span>
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {channelAccounts.map((order) => renderAccountCard(order))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={!!closeTarget}
        title="Cobrar y cerrar cuenta"
        description={
          closeTarget
            ? (() => {
                const amount =
                  closeTarget.formattedTotal ||
                  formatCurrency(closeTarget.totalAmount);
                const who = orderTitle(closeTarget);
                if (closeTarget.orderType !== "IN_TABLE") {
                  return `¿Cobrar ${who} por ${amount} y cerrar la cuenta?`;
                }
                const linked = linkedTableKeys(closeTarget);
                if (linked && linked.length > 1) {
                  return `¿Cobrar ${who} por ${amount}? Las mesas vinculadas quedarán libres.`;
                }
                return `¿Cobrar ${who} por ${amount} y liberar la mesa?`;
              })()
            : ""
        }
        detail={
          closeTarget ? (
            <button
              type="button"
              onClick={() => {
                setPreCuentaKind("cuenta");
                setPreCuentaOrder(closeTarget);
              }}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing}`}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir cuenta antes de cobrar
            </button>
          ) : null
        }
        confirmLabel="Cobrar"
        busyLabel="Cobrando…"
        tone="live"
        busy={busy}
        error={closeError}
        onConfirm={() => void confirmClose()}
        onCancel={cancelCloseDialog}
      />

      <PreCuentaModal
        open={preCuentaOrder != null}
        onClose={() => setPreCuentaOrder(null)}
        order={preCuentaOrder}
        restaurant={ticketRestaurant}
        kind={preCuentaKind}
      />

      <ConfirmDialog
        open={dismissCallTarget !== null || dismissClearableOpen}
        title={
          dismissClearableOpen
            ? "¿Limpiar avisos?"
            : "¿Descartar pedido de cuenta?"
        }
        description={
          dismissClearableOpen
            ? activeCallId
              ? "Se quitan los avisos pendientes. El aviso En curso se mantiene hasta que termines Cobrar o la comanda."
              : "Se quitan todos los avisos de mesa, incluidos los que piden la cuenta."
            : dismissCallTarget
              ? `Mesa ${normalizeTableKey(dismissCallTarget.tableNumber) || dismissCallTarget.tableNumber} pide la cuenta. Si descartas, puedes perder el aviso en el apuro.`
              : ""
        }
        confirmLabel={
          dismissClearableOpen ? "Limpiar avisos" : "Descartar aviso"
        }
        cancelLabel="Conservar"
        tone="danger"
        onConfirm={() => {
          if (dismissClearableOpen) {
            setTableCalls((prev) =>
              activeCallId
                ? prev.filter((c) => c.id === activeCallId)
                : [],
            );
            if (armTimerRef.current) clearTimeout(armTimerRef.current);
            armTimerRef.current = null;
            setArmedCallId(null);
            setDismissClearableOpen(false);
            return;
          }
          if (dismissCallTarget) {
            const id = dismissCallTarget.id;
            setTableCalls((prev) => prev.filter((c) => c.id !== id));
            if (armedCallId === id) {
              if (armTimerRef.current) clearTimeout(armTimerRef.current);
              armTimerRef.current = null;
              setArmedCallId(null);
            }
            setDismissCallTarget(null);
          }
        }}
        onCancel={() => {
          setDismissCallTarget(null);
          setDismissClearableOpen(false);
        }}
      />

      <MergeTablesModal
        open={mergeOpen}
        occupiedTables={Array.from(occupiedTableKeys)}
        floorSize={floorSize}
        busy={busy}
        error={mergeError}
        onConfirm={(primary, secondaries) => {
          void confirmMerge(primary, secondaries);
        }}
        onCancel={() => !busy && setMergeOpen(false)}
      />

      <WaiterPosDrawer
        open={!!posTarget}
        tenantSlug={tenantSlug}
        tableNumber={posTarget?.tableNumber ?? ""}
        activeOrderUuid={posTarget?.activeOrderUuid}
        openAccount={posOpenAccount}
        busy={busy}
        onClose={() => {
          if (busy) return;
          setPosTarget(null);
          setActiveCallId(null);
        }}
        onSubmit={submitPos}
      />
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-card px-1.5 font-mono text-xs font-semibold leading-none text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {children}
    </kbd>
  );
}

/**
 * Atajos táctiles (mismo patrón que cocina): botón ≥44px + panel, no solo title.
 */
function WaiterShortcutCheatsheet() {
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
        aria-controls="salon-shortcuts-panel"
        aria-label={
          expanded ? "Ocultar atajos de teclado" : "Mostrar atajos de teclado"
        }
        onClick={() => setExpanded((open) => !open)}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary px-2.5 text-foreground hover:bg-secondary/80 md:px-3 ${focusRing}`}
      >
        <Keyboard className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-bold tracking-tight">Atajos</span>
      </button>
      {expanded ? (
        <div
          id="salon-shortcuts-panel"
          role="region"
          aria-label="Atajos de teclado del salón"
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-border bg-card p-3 shadow-md"
        >
          <ul className="flex flex-col gap-2.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="inline-flex shrink-0 items-center gap-0.5 pt-0.5">
                <Kbd>Enter</Kbd>
                <span aria-hidden className="text-border">
                  /
                </span>
                <Kbd>C</Kbd>
              </span>
              <span>
                Un aviso: ejecuta ya. Varios: arma, luego otra vez
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 pt-0.5 font-semibold text-foreground">
                Aviso
              </span>
              <span>
                Cobrar · Ver mesa (deja En curso y enfoca la cuenta) · Adición ·
                Abrir
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 pt-0.5">
                <Kbd>C</Kbd>
              </span>
              <span>En mesa enfocada y Por cobrar: cobra al instante</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 pt-0.5">
                <Kbd>N</Kbd>
              </span>
              <span>Mesa libre (reabre si un aviso cerró el picker)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 pt-0.5">
                <Kbd>/</Kbd>
              </span>
              <span>Buscar número de mesa libre</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 pt-0.5">
                <Kbd>Esc</Kbd>
              </span>
              <span>Cerrar picker y limpiar la búsqueda</span>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
