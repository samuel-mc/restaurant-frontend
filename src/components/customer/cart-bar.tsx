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
  if (options.length === 0) {
    options.push({ value: "IN_TABLE", label: "En mesa" });
  }
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
  const tableInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("PICKUP");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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
  const isPickupFlow =
    !isAddition && !tableLockedFromQr && orderType === "PICKUP";
  const isInTableFlow =
    isAddition || tableLockedFromQr || orderType === "IN_TABLE";
  /** En mesa: nombre/teléfono opcionales se colapsan para no competir con confirmar. */
  const showGuestFieldsUpFront = !isInTableFlow;

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
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSubmitting) return;
      event.preventDefault();
      if (confirmClear) {
        setConfirmClear(false);
        return;
      }
      if (pendingTableChange) {
        onCancelPendingTableChange?.();
        return;
      }
      closeSheet();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [
    isOpen,
    isSubmitting,
    confirmClear,
    isEditingTable,
    pendingTableChange,
    onCancelPendingTableChange,
  ]);

  // Si el padre pide editar mesa, abrir el sheet para que solo exista un editor.
  useEffect(() => {
    if (isEditingTable) {
      setErrorMessage(null);
      setConfirmClear(false);
      setIsOpen(true);
    }
  }, [isEditingTable]);

  useEffect(() => {
    if (!isOpen || !isEditingTable || pendingTableChange) return;
    const id = window.requestAnimationFrame(() => {
      tableInputRef.current?.focus();
      tableInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, isEditingTable, pendingTableChange]);

  useEffect(() => {
    if (!isOpen || isEditingTable || pendingTableChange) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(titleId)?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, isEditingTable, pendingTableChange, titleId]);

  function closeSheet() {
    if (isSubmitting) return;
    if (pendingTableChange) onCancelPendingTableChange?.();
    if (isEditingTable) onCancelTableEdit?.();
    setConfirmClear(false);
    setIsOpen(false);
    setErrorMessage(null);
  }

  function openSheet() {
    setErrorMessage(null);
    setConfirmClear(false);
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

    const effectiveType = isAddition ? "IN_TABLE" : orderType;
    const effectiveTable = tableNumber.trim();
    const name = customerName.trim() || sessionName || "";
    const phone = customerPhone.trim();

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

  const sheetTitle = isAddition
    ? "Sumar a tu cuenta"
    : isPickupFlow
      ? "Pedido para llevar"
      : orderType === "DELIVERY"
        ? "Pedido a domicilio"
        : "Tu pedido";

  const sheetHint =
    isAddition && sessionTable
      ? `Se suma a ${formatTableLabel(sessionTable)}`
      : isPickupFlow
        ? "Recoges en el local · te avisamos al teléfono"
        : tableLockedFromQr
          ? `${formatTableLabel(tableNumber || sessionTable || "")} · pedís aquí`
          : orderType === "DELIVERY"
            ? "Llega a la dirección que indiques"
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

  const barLabel = isAddition
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
            aria-label="Cerrar pedido"
            disabled={isSubmitting}
            onClick={closeSheet}
            className="absolute inset-0 bg-black/45 disabled:cursor-wait"
          />

          <div className="sheet-enter relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[1.5rem] border border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.28)]">
            <div
              aria-hidden
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-border"
            />

            <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  tabIndex={-1}
                  className="text-lg font-bold tracking-tight outline-none"
                >
                  {sheetTitle}
                </h2>
                {sheetHint || (tableLockedFromQr && onChangeTable) ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {sheetHint ? (
                      <p className="text-xs text-muted-foreground">{sheetHint}</p>
                    ) : null}
                    {tableLockedFromQr && !isAddition && onChangeTable ? (
                      <button
                        type="button"
                        disabled={isSubmitting || isEditingTable}
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
                aria-label="Cerrar pedido"
                disabled={isSubmitting}
                onClick={closeSheet}
                className={`${focusRing} -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground`}
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="border-y border-border/80 px-5">
                {orderedLines.map(({ product, quantity }) => (
                  <li
                    key={product.uuid}
                    className="flex items-center gap-3 border-b border-border/80 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-semibold tracking-tight"
                        title={product.name}
                      >
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(product.price * quantity)}
                      </p>
                    </div>
                    <QuantityStepper
                      quantity={quantity}
                      label={product.name}
                      onIncrement={() => addItem(product)}
                      onDecrement={() => {
                        if (count === 1) setIsOpen(false);
                        decrementItem(product.uuid);
                      }}
                    />
                  </li>
                ))}
              </ul>

              <div className="space-y-3 px-5 py-3">
                {!isAddition && !tableLockedFromQr && orderTypes.length > 1 ? (
                  <div
                    role="group"
                    aria-label="Tipo de pedido"
                    className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1"
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
                          className={`${focusRing} min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors ${
                            active
                              ? "bg-card text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)]"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                    {isEditingTable ? (
                      <div className="space-y-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Mesa
                          </span>
                          <input
                            ref={tableInputRef}
                            type="text"
                            name="tableNumber"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="Ej. 12"
                            value={draftTable}
                            disabled={isSubmitting || Boolean(pendingTableChange)}
                            onChange={(event) => {
                              onDraftTableChange?.(event.target.value);
                            }}
                            onKeyDown={(event) => {
                              if (pendingTableChange) return;
                              if (event.key === "Enter") {
                                event.preventDefault();
                                onConfirmTableEdit?.();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                onCancelTableEdit?.();
                              }
                            }}
                            className={fieldClass}
                            aria-invalid={Boolean(tableEditError)}
                          />
                        </label>
                        {tableEditError ? (
                          <p
                            role="alert"
                            className="text-xs font-medium text-destructive"
                          >
                            {tableEditError}
                          </p>
                        ) : null}
                        {pendingTableChange ? (
                          <div
                            role="alertdialog"
                            aria-labelledby="table-change-title"
                            className="space-y-2 rounded-xl border border-border bg-secondary/50 px-3 py-3"
                          >
                            <p
                              id="table-change-title"
                              className="text-sm font-semibold text-foreground"
                            >
                              ¿Cambiar a {formatTableLabel(pendingTableChange)}?
                            </p>
                            <p className="text-xs leading-snug text-muted-foreground">
                              Se desliga la cuenta abierta de esta mesa. Tu
                              carrito se conserva.
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onConfirmTableEdit}
                                className={`${focusRing} rounded-xl bg-[var(--menu-accent)] px-3.5 py-2 text-xs font-bold text-[var(--menu-accent-fg)]`}
                              >
                                Sí, cambiar mesa
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onCancelPendingTableChange}
                                className={`${focusRing} rounded-xl bg-secondary px-3.5 py-2 text-xs font-bold text-muted-foreground`}
                              >
                                Seguir en esta mesa
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={onConfirmTableEdit}
                              className={`${focusRing} rounded-xl bg-[var(--menu-accent)] px-3.5 py-2 text-xs font-bold text-[var(--menu-accent-fg)]`}
                            >
                              Usar esta mesa
                            </button>
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={onCancelTableEdit}
                              className={`${focusRing} rounded-xl bg-secondary px-3.5 py-2 text-xs font-bold text-muted-foreground`}
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : !isAddition &&
                      !tableLockedFromQr &&
                      orderType === "IN_TABLE" ? (
                      <div className="space-y-2">
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
                      </div>
                    ) : null}

                {showGuestFieldsUpFront ? (
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
                  </div>
                ) : (
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
                )}

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

                <div className="pt-1">
                  {confirmClear ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2">
                      <p className="flex-1 text-xs font-medium text-destructive">
                        ¿Vaciar tu pedido?
                      </p>
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
            </div>

            <div className="shrink-0 space-y-2.5 border-t border-border bg-card px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
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
                disabled={isSubmitting || isEditingTable || Boolean(pendingTableChange)}
                aria-busy={isSubmitting}
                onClick={() => {
                  void handleConfirmOrder();
                }}
                className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70`}
              >
                {pendingTableChange
                  ? "Confirma el cambio de mesa"
                  : isEditingTable
                    ? "Confirma la mesa para continuar"
                    : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
