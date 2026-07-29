"use client";

/**
 * Barra flotante del carrito + sheet de un solo panel.
 *
 * - Con ?m= (QR): modo IN_TABLE, mesa bloqueada.
 * - Sin ?m=: exploración → PICKUP / Delivery.
 * - Líneas compactas (×N) por defecto; steppers y Vaciar bajo demanda.
 * - Pickup/delivery: contacto visible tras las líneas; CTA sticky.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { formatTableLabel } from "@/lib/table-session";
import {
  useCartCount,
  useCartStore,
  useCartSubtotal,
} from "@/store/cartStore";
import { QuantityStepper } from "@/components/customer/quantity-stepper";
import {
  createOrder,
  getCreateOrderErrorMessage,
} from "@/services/orderService";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import type { CreateOrderDTO, OrderType } from "@/types/api";

export interface OrderModules {
  hasDelivery: boolean;
  hasPickup: boolean;
}

interface CartBarProps {
  tenantSlug: string;
  modules?: OrderModules;
  /** Mesa anclada por QR (?m=): campo bloqueado. */
  tableLockedFromQr?: boolean;
  isEditingTable?: boolean;
  draftTable?: string;
  tableEditError?: string | null;
  /** Mesa elegida pendiente de confirmar (pedido de la mesa). */
  pendingTableChange?: string | null;
  /** Pedido ya enviado a cocina en la mesa actual (para explicar el desligue). */
  openOrderId?: string | null;
  onDraftTableChange?: (value: string) => void;
  onChangeTable?: () => void;
  /** Liberar QR y seguir con el carrito (pickup / explore). */
  onLeaveWrongTable?: () => void;
  /** Unirse al pedido de la mesa sin cerrar el sheet. */
  onJoinSharedOrder?: () => void;
  /** Deshacer Sumarme sin salir del QR. */
  onUnjoinSharedOrder?: () => void;
  onConfirmTableEdit?: () => void;
  onCancelTableEdit?: () => void;
  onCancelPendingTableChange?: () => void;
}

type OrderTypeOption = {
  value: OrderType;
  label: string;
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const fieldClass =
  "rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/**
 * Sin mesa QR: solo canales de recogida/envío (no “En mesa” manual).
 * Con QR / adición: solo IN_TABLE.
 */
function resolveOrderTypes(
  modules: OrderModules | undefined,
  tableLockedFromQr: boolean,
  isAddition: boolean,
): OrderTypeOption[] {
  if (isAddition || tableLockedFromQr) {
    return [{ value: "IN_TABLE", label: "En mesa" }];
  }

  const options: OrderTypeOption[] = [];
  if (modules?.hasPickup) {
    options.push({ value: "PICKUP", label: "Para llevar" });
  }
  if (modules?.hasDelivery) {
    options.push({ value: "DELIVERY", label: "A domicilio" });
  }
  // Explore sin canales: lista vacía (no fingir «En mesa»).
  return options;
}

function ClearCartConfirm({
  disabled,
  onConfirm,
  onCancel,
}: {
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="clear-cart-title"
      aria-describedby="clear-cart-desc"
      className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p
          id="clear-cart-title"
          className="text-xs font-medium text-destructive"
        >
          ¿Vaciar tu pedido?
        </p>
        <p id="clear-cart-desc" className="sr-only">
          Se eliminan todos los platillos del carrito.
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className={`${focusRing} inline-flex min-h-11 items-center rounded-lg bg-destructive px-3 text-xs font-bold text-white`}
      >
        Vaciar
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCancel}
        className={`${focusRing} inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground`}
      >
        Cancelar
      </button>
    </div>
  );
}

export function CartBar({
  tenantSlug,
  modules,
  tableLockedFromQr = false,
  isEditingTable = false,
  draftTable = "",
  tableEditError = null,
  pendingTableChange = null,
  openOrderId = null,
  onDraftTableChange,
  onChangeTable,
  onLeaveWrongTable,
  onJoinSharedOrder,
  onUnjoinSharedOrder,
  onConfirmTableEdit,
  onCancelTableEdit,
  onCancelPendingTableChange,
}: CartBarProps) {
  const router = useRouter();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tableInputRef = useRef<HTMLInputElement>(null);
  const mesaConfirmRef = useRef<HTMLButtonElement>(null);
  const mesaExtrasRef = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("PICKUP");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  /** En pickup/delivery: líneas compactas; steppers solo al editar. */
  const [linesExpanded, setLinesExpanded] = useState(false);

  const count = useCartCount();
  const subtotal = useCartSubtotal();
  const lines = useCartStore((state) => state.lines);
  const activeOrderId = useCartStore((state) => state.activeOrderId);
  const sessionTable = useCartStore((state) => state.tableNumber);
  const sessionTableToken = useCartStore((state) => state.tableToken);
  const sessionName = useCartStore((state) => state.customerName);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const clearCart = useCartStore((state) => state.clear);
  const setActiveOrderSession = useCartStore(
    (state) => state.setActiveOrderSession,
  );

  const isAddition = Boolean(activeOrderId);
  /** Mesa con pedido ajeno: hay que Sumarme antes de confirmar (evita ticket paralelo). */
  const needsSharedJoin =
    tableLockedFromQr && Boolean(openOrderId) && !isAddition;
  const orderTypes = useMemo(
    () => resolveOrderTypes(modules, tableLockedFromQr, isAddition),
    [modules, tableLockedFromQr, isAddition],
  );
  const orderedLines = useMemo(() => Object.values(lines), [lines]);
  const itemLabel = count === 1 ? "1 platillo" : `${count} platillos`;
  /** Sin QR y sin pickup/delivery: no hay canal operable. */
  const ordersUnavailable =
    !isAddition && !tableLockedFromQr && orderTypes.length === 0;
  const isPickupFlow =
    !isAddition &&
    !tableLockedFromQr &&
    !ordersUnavailable &&
    orderType === "PICKUP";
  const isDeliveryFlow =
    !isAddition &&
    !tableLockedFromQr &&
    !ordersUnavailable &&
    orderType === "DELIVERY";
  const isInTableFlow =
    isAddition || tableLockedFromQr || orderType === "IN_TABLE";
  /** Pickup/delivery: contacto visible (no colapsado). */
  const showGuestFieldsUpFront = !isInTableFlow && !ordersUnavailable;
  /** Líneas compactas por defecto en todos los modos; steppers solo al editar. */
  const showLineSteppers = linesExpanded;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const prevCountRef = useRef(count);
  const [countBump, setCountBump] = useState(false);

  useEffect(() => {
    if (count > prevCountRef.current) {
      setCountBump(true);
      const id = window.setTimeout(() => setCountBump(false), 280);
      prevCountRef.current = count;
      return () => window.clearTimeout(id);
    }
    prevCountRef.current = count;
  }, [count]);

  useEffect(() => {
    if (!orderTypes.some((opt) => opt.value === orderType)) {
      setOrderType(orderTypes[0]?.value ?? "PICKUP");
    }
  }, [orderTypes, orderType]);

  useEffect(() => {
    setErrorMessage(null);
  }, [orderType]);

  useEffect(() => {
    if (isAddition || tableLockedFromQr) {
      setOrderType("IN_TABLE");
      if (sessionTable) setTableNumber(sessionTable);
      if (sessionName) setCustomerName(sessionName);
      return;
    }
    const pickup = orderTypes.find((opt) => opt.value === "PICKUP");
    if (pickup) setOrderType("PICKUP");
  }, [
    isAddition,
    tableLockedFromQr,
    sessionTable,
    sessionName,
    orderTypes,
  ]);

  useEffect(() => {
    if (isEditingTable) {
      setErrorMessage(null);
      setConfirmClear(false);
      setIsOpen(true);
    }
  }, [isEditingTable]);

  function closeSheet() {
    if (isSubmitting) return;
    // Sub-vista mesa: volver al pedido, no cerrar el sheet.
    if (pendingTableChange) {
      onCancelPendingTableChange?.();
      return;
    }
    if (isEditingTable) {
      onCancelTableEdit?.();
      setConfirmClear(false);
      setErrorMessage(null);
      return;
    }
    setConfirmClear(false);
    setIsOpen(false);
    setErrorMessage(null);
  }

  useEffect(() => {
    if (!isOpen && mesaExtrasRef.current) {
      mesaExtrasRef.current.open = false;
    }
  }, [isOpen]);

  const sheetPanelRef = useModalFocusTrap({
    open: isOpen,
    escapeEnabled: !isSubmitting,
    initialFocusRef: titleRef,
    onEscape: () => {
      if (confirmClear) {
        setConfirmClear(false);
        return;
      }
      closeSheet();
    },
  });

  useEffect(() => {
    if (!isOpen || !isEditingTable || pendingTableChange) return;
    const id = window.requestAnimationFrame(() => {
      tableInputRef.current?.focus();
      tableInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, isEditingTable, pendingTableChange]);

  useEffect(() => {
    if (!pendingTableChange) return;
    const id = window.requestAnimationFrame(() => {
      mesaConfirmRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [pendingTableChange]);

  function openSheet() {
    setErrorMessage(null);
    setConfirmClear(false);
    setLinesExpanded(false);
    setIsOpen(true);
  }

  function handleClearCart() {
    if (isSubmitting) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearCart();
    setConfirmClear(false);
    setIsOpen(false);
    setErrorMessage(null);
    if (isEditingTable) onCancelTableEdit?.();
  }

  async function handleConfirmOrder() {
    if (isSubmitting || orderedLines.length === 0) return;
    setErrorMessage(null);

    if (ordersUnavailable) {
      setErrorMessage(
        "Este local no acepta pedidos para llevar ni a domicilio por ahora. Usa el QR de tu mesa.",
      );
      return;
    }

    if (needsSharedJoin) {
      if (onJoinSharedOrder) {
        onJoinSharedOrder();
        return;
      }
      setErrorMessage(
        "Súmate primero al pedido de la mesa para enviar estos platillos.",
      );
      return;
    }

    const effectiveType = isAddition ? "IN_TABLE" : orderType;
    const effectiveTable = tableNumber.trim();
    const name = customerName.trim() || sessionName || "";
    const phone = customerPhone.trim();

    if (
      !isAddition &&
      !tableLockedFromQr &&
      effectiveType === "IN_TABLE"
    ) {
      setErrorMessage(
        "Este local no acepta pedidos para llevar ni a domicilio por ahora. Usa el QR de tu mesa.",
      );
      return;
    }

    if (effectiveType === "IN_TABLE" && !effectiveTable && !isAddition) {
      setErrorMessage("Escribe el número de mesa.");
      return;
    }
    if (
      effectiveType === "IN_TABLE" &&
      !isAddition &&
      !(sessionTableToken || "").trim()
    ) {
      setErrorMessage(
        "Escanea el código QR de tu mesa para pedir. El enlace debe incluir el token de acceso.",
      );
      return;
    }
    if (isAddition && !activeOrderId) {
      setErrorMessage("No hay un pedido de la mesa para sumar platillos.");
      return;
    }
    if (effectiveType === "PICKUP" || effectiveType === "DELIVERY") {
      if (!name) {
        setErrorMessage(
          effectiveType === "DELIVERY"
            ? "Escribe tu nombre para el pedido a domicilio."
            : "Escribe tu nombre para el pedido para llevar.",
        );
        window.requestAnimationFrame(() => nameInputRef.current?.focus());
        return;
      }
      if (!phone) {
        setErrorMessage(
          effectiveType === "DELIVERY"
            ? "Escribe tu teléfono para coordinar la entrega."
            : "Escribe tu teléfono para avisarte cuando esté listo.",
        );
        window.requestAnimationFrame(() => phoneInputRef.current?.focus());
        return;
      }
    }
    if (effectiveType === "DELIVERY" && !deliveryAddress.trim()) {
      setErrorMessage("Escribe la dirección de entrega.");
      window.requestAnimationFrame(() => addressInputRef.current?.focus());
      return;
    }

    setIsSubmitting(true);

    const orderData: CreateOrderDTO = {
      items: orderedLines.map(({ product, quantity }) => ({
        productId: product.uuid,
        quantity,
      })),
      tableNumber:
        effectiveType === "IN_TABLE"
          ? effectiveTable || sessionTable || null
          : null,
      deliveryAddress:
        effectiveType === "DELIVERY" ? deliveryAddress.trim() || null : null,
      customerName: name || null,
      customerPhone: phone || null,
      total: subtotal,
      orderType: effectiveType,
      activeOrderUuid: isAddition ? activeOrderId : null,
      tableToken:
        effectiveType === "IN_TABLE" ? sessionTableToken || null : null,
    };

    try {
      const order = await createOrder(orderData, tenantSlug);
      if (order.orderType === "IN_TABLE" && order.tableNumber) {
        setActiveOrderSession({
          activeOrderId: order.uuid,
          tableNumber: order.tableNumber,
          customerName: order.customerName,
          tableToken: sessionTableToken,
        });
      }
      clearCart();
      setIsOpen(false);
      router.push(`/orders/${order.uuid}`);
    } catch (error) {
      setErrorMessage(getCreateOrderErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (count === 0) return null;

  const isMesaEditView = isEditingTable;
  const rawMesa = (tableNumber || sessionTable || draftTable || "").trim();
  const currentMesaLabel = rawMesa ? formatTableLabel(rawMesa) : "";

  const sheetTitle = isMesaEditView
    ? pendingTableChange
      ? "Confirmar cambio de mesa"
      : "Cambiar mesa"
    : ordersUnavailable
      ? "Pedidos no disponibles"
      : isAddition
        ? "Sumar a tu pedido"
        : isPickupFlow
          ? "Pedido para llevar"
          : orderType === "DELIVERY"
            ? "Pedido a domicilio"
            : "Tu pedido";

  const sheetHint = isMesaEditView
    ? currentMesaLabel
      ? openOrderId
        ? `Ahora: ${currentMesaLabel} · hay un pedido de la mesa`
        : `Ahora: ${currentMesaLabel}`
      : "Escribe el número correcto de tu mesa"
    : ordersUnavailable
      ? "Para llevar y domicilio están apagados en este local"
      : isAddition && sessionTable
        ? `Unido a ${formatTableLabel(sessionTable)} · listo para enviar`
        : needsSharedJoin
          ? `${formatTableLabel(tableNumber || sessionTable || "")} · hay un pedido de la mesa`
          : isPickupFlow
            ? "Recoges en el local · te avisamos por teléfono"
            : tableLockedFromQr
              ? openOrderId
                ? `${formatTableLabel(tableNumber || sessionTable || "")} · hay un pedido de la mesa`
                : `${formatTableLabel(tableNumber || sessionTable || "")} · listo para pedir`
              : orderType === "DELIVERY"
                ? "Entrega a la dirección que indiques"
                : null;

  const confirmLabel = isSubmitting
    ? isAddition
      ? "Enviando a cocina…"
      : "Enviando pedido…"
    : needsSharedJoin
      ? "Sumarme y continuar"
      : isAddition
        ? "Sumar al pedido"
        : isPickupFlow
          ? "Confirmar para llevar"
          : orderType === "DELIVERY"
            ? "Confirmar a domicilio"
            : "Confirmar pedido";

  const barLabel = ordersUnavailable
    ? `No disponible · ${itemLabel}`
    : needsSharedJoin
      ? `Sumarme · ${itemLabel}`
      : isAddition
        ? `Sumar · ${itemLabel}`
        : isPickupFlow
          ? `Para llevar · ${itemLabel}`
          : orderType === "DELIVERY"
            ? `A domicilio · ${itemLabel}`
            : `Tu pedido · ${itemLabel}`;

  const showChangeMesa =
    tableLockedFromQr && !isAddition && Boolean(onChangeTable);
  const showLeaveMesa = tableLockedFromQr && Boolean(onLeaveWrongTable);
  const showUnjoin = isAddition && Boolean(onUnjoinSharedOrder);
  const showMesaExtras = showChangeMesa || showLeaveMesa || showUnjoin;

  const mesaExtrasLink =
    `${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2`;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md cart-bar-enter p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={openSheet}
          aria-label={`${barLabel}. Total ${formatCurrency(subtotal)}`}
          className={`${focusRing} pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] ${
            ordersUnavailable
              ? "border border-border bg-card text-foreground"
              : "bg-[var(--menu-accent)] text-[var(--menu-accent-fg)]"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-live="polite"
              aria-atomic="true"
              className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-sm tabular-nums ${
                countBump ? "cart-count-bump" : ""
              } ${
                ordersUnavailable
                  ? "bg-secondary text-foreground"
                  : "bg-[var(--menu-accent-fg)]/20"
              }`}
            >
              <span className="sr-only">Platillos en el pedido: </span>
              {count}
            </span>
            <span className="truncate">{barLabel}</span>
          </span>
          <span className="shrink-0 tabular-nums">
            {formatCurrency(subtotal)}
          </span>
        </button>
      </div>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-40 flex items-end justify-center"
        >
          <button
            type="button"
            aria-label={isMesaEditView ? "Volver al pedido" : "Cerrar pedido"}
            disabled={isSubmitting}
            onClick={closeSheet}
            className="absolute inset-0 bg-black/45 disabled:cursor-wait"
          />

          <div
            ref={sheetPanelRef}
            className="sheet-enter relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[1.5rem] border border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
          >
            <div
              aria-hidden
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-[var(--menu-accent)]/40"
            />

            <div className="flex items-start justify-between gap-3 border-t border-[var(--menu-accent-muted)] px-5 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-lg font-bold tracking-tight outline-none"
                >
                  {sheetTitle}
                </h2>
                {sheetHint ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sheetHint}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={isMesaEditView ? "Volver al pedido" : "Cerrar pedido"}
                disabled={isSubmitting}
                onClick={closeSheet}
                className={`${focusRing} -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground`}
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>

            {isMesaEditView && pendingTableChange ? (
              <div
                role="alertdialog"
                aria-labelledby="table-change-title"
                aria-describedby="table-change-desc"
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Número de mesa
                    </span>
                    <input
                      ref={tableInputRef}
                      type="text"
                      name="tableNumber"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={10}
                      placeholder="Ej. 12"
                      value={draftTable}
                      disabled
                      className={fieldClass}
                      aria-describedby="table-change-desc"
                    />
                  </label>
                  <div className="space-y-2 rounded-xl border border-border bg-secondary/50 px-3 py-3">
                    <p
                      id="table-change-title"
                      className="text-sm font-semibold text-foreground"
                    >
                      ¿Cambiar a {formatTableLabel(pendingTableChange)}?
                    </p>
                    <p
                      id="table-change-desc"
                      className="text-xs leading-snug text-muted-foreground"
                    >
                      El pedido que ya enviaste a cocina se queda en la mesa
                      actual; no se cancela. Los platillos de este carrito pasan
                      a la mesa nueva.
                    </p>
                    {openOrderId ? (
                      <Link
                        href={`/orders/${openOrderId}`}
                        className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-foreground underline underline-offset-2`}
                      >
                        Ver pedido de la mesa actual
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                  <button
                    ref={mesaConfirmRef}
                    type="button"
                    disabled={isSubmitting}
                    onClick={onConfirmTableEdit}
                    className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98]`}
                  >
                    Sí, cambiar mesa
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCancelPendingTableChange}
                    className={`${focusRing} w-full rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-muted-foreground`}
                  >
                    Seguir en esta mesa
                  </button>
                </div>
              </div>
            ) : isMesaEditView ? (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Número de mesa
                  </span>
                  <input
                    ref={tableInputRef}
                    type="text"
                    name="tableNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    placeholder="Ej. 12"
                    value={draftTable}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      onDraftTableChange?.(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onConfirmTableEdit?.();
                      }
                    }}
                    className={fieldClass}
                    aria-invalid={Boolean(tableEditError)}
                    aria-describedby={
                      tableEditError ? "table-edit-error" : "table-edit-hint"
                    }
                  />
                </label>
                {tableEditError ? (
                  <p
                    id="table-edit-error"
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    {tableEditError}
                  </p>
                ) : (
                  <p
                    id="table-edit-hint"
                    className="text-xs leading-snug text-muted-foreground"
                  >
                    {openOrderId
                      ? "Si cambias de mesa, el pedido ya enviado a cocina se queda en la mesa actual. El carrito pasa contigo."
                      : "Tu carrito se mantiene; solo cambias el número de mesa."}
                  </p>
                )}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {ordersUnavailable ? (
                  <div className="space-y-4 px-5 py-4">
                    <p
                      role="status"
                      className="rounded-xl border border-border bg-secondary/50 px-3 py-3 text-sm leading-snug text-foreground"
                    >
                      Este local no acepta pedidos para llevar ni a domicilio
                      por ahora. Si estás en el restaurante, pide con el QR de
                      tu mesa.
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {itemLabel} en el carrito · puedes vaciarlo abajo
                    </p>
                    <ul className="divide-y divide-border/60">
                      {orderedLines.map(({ product, quantity }) => (
                        <li
                          key={product.uuid}
                          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-medium tracking-tight text-foreground"
                              title={product.name}
                            >
                              {product.name}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            ×{quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-1">
                      {confirmClear ? (
                        <ClearCartConfirm
                          disabled={isSubmitting}
                          onConfirm={handleClearCart}
                          onCancel={() => setConfirmClear(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleClearCart}
                          className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-destructive`}
                        >
                          Vaciar pedido
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                {!isAddition && !tableLockedFromQr && showGuestFieldsUpFront && orderTypes.length > 1 ? (
                  <div className="border-b border-border/80 px-5 py-2.5">
                    <div
                      role="group"
                      aria-label="Para llevar o a domicilio"
                      className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1"
                    >
                      {orderTypes.map((opt) => {
                        const active = orderType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isSubmitting}
                            aria-pressed={active}
                            onClick={() => setOrderType(opt.value)}
                            className={`${focusRing} min-h-11 rounded-lg px-3 text-xs font-semibold transition-colors ${
                              active
                                ? "bg-card text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="px-5 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {itemLabel}
                    </p>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      aria-expanded={linesExpanded}
                      onClick={() => setLinesExpanded((open) => !open)}
                      className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2`}
                    >
                      {linesExpanded ? "Listo" : "Editar cantidades"}
                    </button>
                  </div>

                  <ul className="divide-y divide-border/60">
                    {orderedLines.map(({ product, quantity }) => (
                      <li
                        key={product.uuid}
                        className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium tracking-tight text-foreground"
                            title={product.name}
                          >
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(product.price * quantity)}
                          </p>
                        </div>
                        {showLineSteppers ? (
                          <QuantityStepper
                            quantity={quantity}
                            label={product.name}
                            onIncrement={() => addItem(product)}
                            onDecrement={() => decrementItem(product.uuid)}
                          />
                        ) : (
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            ×{quantity}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {isInTableFlow ? (
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                      {!isAddition &&
                      !tableLockedFromQr &&
                      orderType === "IN_TABLE" ? (
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Mesa
                          </span>
                          <input
                            type="text"
                            name="tableNumber"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="Ej. 12"
                            value={tableNumber}
                            disabled={isSubmitting}
                            onChange={(event) =>
                              setTableNumber(event.target.value)
                            }
                            className={fieldClass}
                          />
                        </label>
                      ) : null}

                      <details className="group">
                        <summary
                          className={`${focusRing} flex min-h-11 cursor-pointer list-none items-center text-xs font-medium text-muted-foreground underline-offset-2 marker:content-none hover:underline [&::-webkit-details-marker]:hidden`}
                        >
                          Nombre o teléfono (opcional)
                        </summary>
                        <div className="mt-2 space-y-2.5">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              Nombre
                            </span>
                            <input
                              type="text"
                              name="customerName"
                              autoComplete="name"
                              maxLength={100}
                              placeholder="Opcional"
                              value={customerName}
                              disabled={isSubmitting}
                              onChange={(event) =>
                                setCustomerName(event.target.value)
                              }
                              className={fieldClass}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">
                              Teléfono
                            </span>
                            <input
                              type="tel"
                              name="customerPhone"
                              autoComplete="tel"
                              maxLength={20}
                              placeholder="Opcional"
                              value={customerPhone}
                              disabled={isSubmitting}
                              onChange={(event) =>
                                setCustomerPhone(event.target.value)
                              }
                              className={fieldClass}
                            />
                          </label>
                        </div>
                      </details>

                      {confirmClear ? (
                        <ClearCartConfirm
                          disabled={isSubmitting}
                          onConfirm={handleClearCart}
                          onCancel={() => setConfirmClear(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleClearCart}
                          className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-destructive`}
                        >
                          Vaciar pedido
                        </button>
                      )}

                      {showMesaExtras ? (
                        <details ref={mesaExtrasRef} className="group pt-1">
                          <summary
                            className={`${focusRing} flex min-h-11 cursor-pointer list-none items-center text-xs font-medium text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden`}
                          >
                            Más opciones
                            <span
                              aria-hidden
                              className="ml-1 transition-transform group-open:rotate-180"
                            >
                              ▾
                            </span>
                          </summary>
                          <div
                            className="flex flex-col gap-0.5 pb-1"
                            role="group"
                            aria-label="Opciones de mesa"
                          >
                            {showChangeMesa ? (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onChangeTable}
                                className={mesaExtrasLink}
                              >
                                Cambiar mesa
                              </button>
                            ) : null}
                            {showLeaveMesa ? (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => {
                                  onLeaveWrongTable?.();
                                }}
                                className={mesaExtrasLink}
                              >
                                Salir y seguir con este carrito
                              </button>
                            ) : null}
                            {showUnjoin ? (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onUnjoinSharedOrder}
                                className={mesaExtrasLink}
                              >
                                Dejar de sumarme
                              </button>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : showGuestFieldsUpFront ? (
                    <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {isPickupFlow
                          ? "Para avisarte cuando esté listo"
                          : "Datos de entrega"}
                      </p>
                      <div className="space-y-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            Nombre *
                          </span>
                          <input
                            ref={nameInputRef}
                            type="text"
                            name="customerName"
                            autoComplete="name"
                            maxLength={100}
                            required
                            placeholder="Tu nombre"
                            value={customerName}
                            disabled={isSubmitting}
                            onChange={(event) =>
                              setCustomerName(event.target.value)
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            Teléfono *
                          </span>
                          <input
                            ref={phoneInputRef}
                            type="tel"
                            name="customerPhone"
                            autoComplete="tel"
                            maxLength={20}
                            required
                            placeholder={
                              isDeliveryFlow
                                ? "Para coordinar la entrega"
                                : "Para avisarte"
                            }
                            value={customerPhone}
                            disabled={isSubmitting}
                            onChange={(event) =>
                              setCustomerPhone(event.target.value)
                            }
                            className={fieldClass}
                          />
                        </label>
                        {isDeliveryFlow ? (
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              Dirección de entrega *
                            </span>
                            <input
                              ref={addressInputRef}
                              type="text"
                              name="deliveryAddress"
                              autoComplete="street-address"
                              maxLength={255}
                              required
                              placeholder="Calle, número, colonia…"
                              value={deliveryAddress}
                              disabled={isSubmitting}
                              onChange={(event) =>
                                setDeliveryAddress(event.target.value)
                              }
                              className={fieldClass}
                            />
                          </label>
                        ) : null}
                      </div>

                      {confirmClear ? (
                        <ClearCartConfirm
                          disabled={isSubmitting}
                          onConfirm={handleClearCart}
                          onCancel={() => setConfirmClear(false)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleClearCart}
                          className={`${focusRing} inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-destructive`}
                        >
                          Vaciar pedido
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                  </>
                )}
              </div>
            )}

            {!(isMesaEditView && pendingTableChange) ? (
            <div className="sticky bottom-0 z-10 shrink-0 space-y-2.5 border-t border-border bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              {isMesaEditView ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={onConfirmTableEdit}
                      className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98]`}
                    >
                      Confirmar mesa
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={onCancelTableEdit}
                      className={`${focusRing} w-full rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-muted-foreground`}
                    >
                      Volver al pedido
                    </button>
                    {onLeaveWrongTable ? (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          onLeaveWrongTable();
                        }}
                        className={`${focusRing} inline-flex min-h-11 w-full items-center justify-center text-xs font-medium text-muted-foreground underline underline-offset-2`}
                      >
                        Salir y seguir con este carrito
                      </button>
                    ) : null}
                  </div>
              ) : ordersUnavailable ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={closeSheet}
                  className={`${focusRing} w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-semibold text-foreground`}
                >
                  Entendido
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm font-semibold tracking-tight">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums text-foreground">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  {needsSharedJoin && !errorMessage ? (
                    <p
                      role="status"
                      className="rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm leading-snug text-foreground"
                    >
                      Hay un pedido abierto en esta mesa. Súmate para enviar
                      estos platillos a esa cuenta.
                    </p>
                  ) : null}

                  {errorMessage ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm leading-snug text-destructive"
                    >
                      {errorMessage}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    onClick={() => {
                      void handleConfirmOrder();
                    }}
                    className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {confirmLabel}
                  </button>
                </>
              )}
            </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
