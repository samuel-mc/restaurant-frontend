"use client";

/**
 * Barra flotante del carrito + sheet de un solo panel.
 *
 * - Con ?m= (QR): modo IN_TABLE, mesa bloqueada.
 * - Sin ?m=: exploración → PICKUP / Delivery.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  /** Mesa elegida pendiente de confirmar (cuenta abierta). */
  pendingTableChange?: string | null;
  onDraftTableChange?: (value: string) => void;
  onChangeTable?: () => void;
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
  if (modules?.hasPickup ?? true) {
    options.push({ value: "PICKUP", label: "Para llevar" });
  }
  if (modules?.hasDelivery) {
    options.push({ value: "DELIVERY", label: "A domicilio" });
  }
  // Explore sin canales: lista vacía (no fingir «En mesa»).
  return options;
}

export function CartBar({
  tenantSlug,
  modules,
  tableLockedFromQr = false,
  isEditingTable = false,
  draftTable = "",
  tableEditError = null,
  pendingTableChange = null,
  onDraftTableChange,
  onChangeTable,
  onConfirmTableEdit,
  onCancelTableEdit,
  onCancelPendingTableChange,
}: CartBarProps) {
  const router = useRouter();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tableInputRef = useRef<HTMLInputElement>(null);
  const mesaConfirmRef = useRef<HTMLButtonElement>(null);
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
  const sessionName = useCartStore((state) => state.customerName);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const clearCart = useCartStore((state) => state.clear);
  const setActiveOrderSession = useCartStore(
    (state) => state.setActiveOrderSession,
  );

  const isAddition = Boolean(activeOrderId);
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
  const isInTableFlow =
    isAddition || tableLockedFromQr || orderType === "IN_TABLE";
  /** En mesa: nombre/teléfono opcionales se colapsan para no competir con confirmar. */
  const showGuestFieldsUpFront = !isInTableFlow && !ordersUnavailable;

  useEffect(() => {
    if (!orderTypes.some((opt) => opt.value === orderType)) {
      setOrderType(orderTypes[0]?.value ?? "PICKUP");
    }
  }, [orderTypes, orderType]);

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
    if (isAddition && !activeOrderId) {
      setErrorMessage("No hay una cuenta abierta para sumar platillos.");
      return;
    }
    if (effectiveType === "PICKUP") {
      if (!name) {
        setErrorMessage("Escribe tu nombre para el pedido para llevar.");
        return;
      }
      if (!phone) {
        setErrorMessage("Escribe tu teléfono para avisarte cuando esté listo.");
        return;
      }
    }
    if (effectiveType === "DELIVERY" && !deliveryAddress.trim()) {
      setErrorMessage("Escribe la dirección de entrega.");
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
    };

    try {
      const order = await createOrder(orderData, tenantSlug);
      if (order.orderType === "IN_TABLE" && order.tableNumber) {
        setActiveOrderSession({
          activeOrderId: order.uuid,
          tableNumber: order.tableNumber,
          customerName: order.customerName,
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
      ? "Confirmar cambio"
      : "Cambiar mesa"
    : ordersUnavailable
      ? "Pedidos no disponibles"
      : isAddition
        ? "Sumar a tu cuenta"
        : isPickupFlow
          ? "Pedido para llevar"
          : orderType === "DELIVERY"
            ? "Pedido a domicilio"
            : "Tu pedido";

  const sheetHint = isMesaEditView
    ? currentMesaLabel
      ? `Ahora: ${currentMesaLabel} · tu pedido se mantiene`
      : "Escribe el número correcto de mesa"
    : ordersUnavailable
      ? "Para llevar y domicilio están apagados en este local"
      : isAddition && sessionTable
        ? `Se suma a ${formatTableLabel(sessionTable)}`
        : isPickupFlow
          ? "Recoges en el local · te avisamos por teléfono"
          : tableLockedFromQr
            ? `${formatTableLabel(tableNumber || sessionTable || "")} · pedido en esta mesa`
            : orderType === "DELIVERY"
              ? "Entrega a la dirección que indiques"
              : null;

  const confirmLabel = isSubmitting
    ? isAddition
      ? "Enviando a cocina…"
      : "Enviando pedido…"
    : isAddition
      ? "Sumar a la cuenta"
      : isPickupFlow
        ? "Confirmar para llevar"
        : orderType === "DELIVERY"
          ? "Confirmar a domicilio"
          : "Confirmar pedido";

  const barLabel = ordersUnavailable
    ? `No disponible · ${itemLabel}`
    : isAddition
      ? `Sumar · ${itemLabel}`
      : isPickupFlow
        ? `Para llevar · ${itemLabel}`
        : orderType === "DELIVERY"
          ? `A domicilio · ${itemLabel}`
          : `Tu pedido · ${itemLabel}`;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={openSheet}
          aria-label={`${barLabel}. Total ${formatCurrency(subtotal)}`}
          className={`${focusRing} pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98]`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-[var(--menu-accent-fg)]/20 px-2 text-sm tabular-nums">
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
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-border"
            />

            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-lg font-bold tracking-tight outline-none"
                >
                  {sheetTitle}
                </h2>
                {sheetHint ||
                (!isMesaEditView &&
                  tableLockedFromQr &&
                  onChangeTable) ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {sheetHint ? (
                      <p className="text-xs text-muted-foreground">{sheetHint}</p>
                    ) : null}
                    {!isMesaEditView &&
                    tableLockedFromQr &&
                    !isAddition &&
                    onChangeTable ? (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onChangeTable}
                        className={`${focusRing} text-xs font-medium text-muted-foreground underline underline-offset-2`}
                      >
                        Cambiar mesa
                      </button>
                    ) : null}
                  </div>
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
                      Se desliga la cuenta abierta de esta mesa. Tu carrito se
                      conserva.
                    </p>
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
                    El pedido que armaste se mantiene; solo cambia la mesa.
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
                            disabled={isSubmitting}
                            onClick={handleClearCart}
                            className={`${focusRing} rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-bold text-white`}
                          >
                            Vaciar
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setConfirmClear(false)}
                            className={`${focusRing} rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground`}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleClearCart}
                          className={`${focusRing} text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-destructive`}
                        >
                          Vaciar pedido
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                {showGuestFieldsUpFront ? (
                  <div className="space-y-3 border-b border-border/80 px-5 py-3">
                    {!isAddition && !tableLockedFromQr && orderTypes.length > 1 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          ¿Cómo lo quieres?
                        </p>
                        <div
                          role="group"
                          aria-label="Para llevar o a domicilio"
                          className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/80 p-1"
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

                    <div className="space-y-2.5">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Nombre{isPickupFlow ? " *" : ""}
                        </span>
                        <input
                          type="text"
                          name="customerName"
                          autoComplete="name"
                          maxLength={100}
                          required={isPickupFlow}
                          placeholder={isPickupFlow ? "Tu nombre" : "Opcional"}
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
                          Teléfono{isPickupFlow ? " *" : ""}
                        </span>
                        <input
                          type="tel"
                          name="customerPhone"
                          autoComplete="tel"
                          maxLength={20}
                          required={isPickupFlow}
                          placeholder={
                            isPickupFlow
                              ? "Para avisarte"
                              : orderType === "DELIVERY"
                                ? "Recomendado"
                                : "Opcional"
                          }
                          value={customerPhone}
                          disabled={isSubmitting}
                          onChange={(event) =>
                            setCustomerPhone(event.target.value)
                          }
                          className={fieldClass}
                        />
                      </label>
                      {!isAddition && orderType === "DELIVERY" ? (
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Dirección de entrega *
                          </span>
                          <input
                            type="text"
                            name="deliveryAddress"
                            autoComplete="street-address"
                            maxLength={255}
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
                  </div>
                ) : null}

                <div className="px-5 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {itemLabel}
                    </p>
                    {showGuestFieldsUpFront ? (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        aria-expanded={linesExpanded}
                        onClick={() => setLinesExpanded((open) => !open)}
                        className={`${focusRing} text-xs font-medium text-muted-foreground underline underline-offset-2`}
                      >
                        {linesExpanded ? "Listo" : "Editar cantidades"}
                      </button>
                    ) : null}
                  </div>

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
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(product.price * quantity)}
                          </p>
                        </div>
                        {linesExpanded || !showGuestFieldsUpFront ? (
                          <QuantityStepper
                            quantity={quantity}
                            label={product.name}
                            onIncrement={() => addItem(product)}
                            onDecrement={() => {
                              if (count === 1) setIsOpen(false);
                              decrementItem(product.uuid);
                            }}
                          />
                        ) : (
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            ×{quantity}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!showGuestFieldsUpFront ? (
                    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
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
                          className={`${focusRing} cursor-pointer list-none py-1 text-xs font-medium text-muted-foreground underline-offset-2 marker:content-none hover:underline [&::-webkit-details-marker]:hidden`}
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
                    </div>
                  ) : null}

                  <div className="mt-3 pt-1">
                    {confirmClear ? (
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
                          disabled={isSubmitting}
                          onClick={handleClearCart}
                          className={`${focusRing} rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-bold text-white`}
                        >
                          Vaciar
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setConfirmClear(false)}
                          className={`${focusRing} rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground`}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleClearCart}
                        className={`${focusRing} text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-destructive`}
                      >
                        Vaciar pedido
                      </button>
                    )}
                  </div>
                </div>
                  </>
                )}
              </div>
            )}

            {!(isMesaEditView && pendingTableChange) ? (
            <div className="shrink-0 space-y-2.5 border-t border-border bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              {isMesaEditView ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={onConfirmTableEdit}
                      className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98]`}
                    >
                      Usar esta mesa
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={onCancelTableEdit}
                      className={`${focusRing} w-full rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-muted-foreground`}
                    >
                      Volver al pedido
                    </button>
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
                    className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70`}
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
