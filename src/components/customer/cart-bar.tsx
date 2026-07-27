"use client";

/**
 * Barra flotante del carrito + sheet: lista → datos → confirmar.
 *
 * - Con ?m= (QR): modo IN_TABLE, mesa bloqueada.
 * - Sin ?m=: exploración → PICKUP (nombre + teléfono; sin campo mesa).
 */

import { useEffect, useId, useMemo, useState } from "react";
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
  onChangeTable?: () => void;
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
    options.push({ value: "DELIVERY", label: "Delivery" });
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
  onChangeTable,
}: CartBarProps) {
  const router = useRouter();
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("PICKUP");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const itemLabel = count === 1 ? "1 ítem" : `${count} ítems`;
  const isPickupFlow =
    !isAddition && !tableLockedFromQr && orderType === "PICKUP";

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
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  async function handleConfirmOrder() {
    if (isSubmitting || orderedLines.length === 0) return;
    setErrorMessage(null);

    const effectiveType = isAddition ? "IN_TABLE" : orderType;
    const effectiveTable = tableNumber.trim();
    const name = customerName.trim() || sessionName || "";
    const phone = customerPhone.trim();

    if (effectiveType === "IN_TABLE" && !effectiveTable && !isAddition) {
      setErrorMessage("Indica el número de mesa para tu pedido.");
      return;
    }
    if (isAddition && !activeOrderId) {
      setErrorMessage("No hay una orden activa para agregar platillos.");
      return;
    }
    if (effectiveType === "PICKUP") {
      if (!name) {
        setErrorMessage("Indica tu nombre para el pedido para llevar.");
        return;
      }
      if (!phone) {
        setErrorMessage("Indica tu teléfono para avisar cuando esté listo.");
        return;
      }
    }
    if (effectiveType === "DELIVERY" && !deliveryAddress.trim()) {
      setErrorMessage("Indica la dirección de entrega.");
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
    ? "Adición a tu mesa"
    : isPickupFlow
      ? "Pedido para llevar"
      : orderType === "DELIVERY"
        ? "Pedido a domicilio"
        : "Tu pedido";

  const sheetHint = isAddition && sessionTable
    ? `Se suma a la cuenta · ${formatTableLabel(sessionTable)}`
    : isPickupFlow
      ? "Recoges en el local · te avisamos al teléfono"
      : tableLockedFromQr
        ? `${formatTableLabel(tableNumber || sessionTable || "")} · detectada por QR`
        : null;

  const confirmLabel = isSubmitting
    ? isAddition
      ? "Enviando adición…"
      : "Enviando pedido…"
    : isAddition
      ? "Enviar adición a cocina"
      : isPickupFlow
        ? "Confirmar para llevar"
        : orderType === "DELIVERY"
          ? "Confirmar delivery"
          : "Confirmar pedido";

  const barLabel = isAddition
    ? `Adición · ${itemLabel}`
    : isPickupFlow
      ? `Para llevar · ${itemLabel}`
      : `Ver pedido · ${itemLabel}`;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsOpen(true);
          }}
          className={`${focusRing} pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition-transform active:scale-[0.98]`}
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
            aria-label="Cerrar resumen"
            disabled={isSubmitting}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/45 disabled:cursor-wait"
          />

          <div className="sheet-enter relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[1.5rem] border border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.28)]">
            <div
              aria-hidden
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-border"
            />

            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-bold tracking-tight">
                  {sheetTitle}
                </h2>
                {sheetHint ? (
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {sheetHint}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsOpen(false);
                  clearCart();
                }}
                className={`${focusRing} shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-destructive transition-transform active:scale-95 disabled:opacity-40`}
              >
                Vaciar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul className="space-y-0 border-y border-border px-5">
                {orderedLines.map(({ product, quantity }) => (
                  <li
                    key={product.uuid}
                    className="flex items-center gap-3 border-b border-border py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight">
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

              <div className="space-y-4 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Datos del pedido
                </p>

                {!isAddition && !tableLockedFromQr && orderTypes.length > 1 ? (
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-muted-foreground">
                      Tipo de pedido
                    </legend>
                    <div
                      role="group"
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
                            className={`${focusRing} min-h-10 rounded-lg px-3 text-xs font-bold transition-colors ${
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
                  </fieldset>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      onChange={(event) => setCustomerName(event.target.value)}
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
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>

                {isAddition || tableLockedFromQr || orderType === "IN_TABLE" ? (
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
                        readOnly={tableLockedFromQr || isAddition}
                        disabled={
                          isSubmitting || tableLockedFromQr || isAddition
                        }
                        onChange={(event) => setTableNumber(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    {tableLockedFromQr ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-lg bg-live-muted px-2.5 py-1 text-xs font-bold text-live-ink">
                          {formatTableLabel(tableNumber || "")} · QR
                        </span>
                        {onChangeTable ? (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={onChangeTable}
                            className={`${focusRing} text-xs font-medium text-muted-foreground underline underline-offset-2`}
                          >
                            ¿No es tu mesa? Cambiar
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

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

            <div className="space-y-3 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between text-base font-bold tracking-tight">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
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
                onClick={() => {
                  void handleConfirmOrder();
                }}
                className={`${focusRing} w-full rounded-2xl bg-[var(--menu-accent)] px-5 py-4 font-semibold text-[var(--menu-accent-fg)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
