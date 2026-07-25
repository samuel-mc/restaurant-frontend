"use client";

/**
 * Botón flotante del carrito + drawer: pedido nuevo o adición a mesa.
 *
 * - Con ?m= (QR): modo IN_TABLE, mesa bloqueada.
 * - Sin ?m=: exploración → PICKUP (nombre + teléfono; sin campo mesa).
 */

import { useEffect, useMemo, useState } from "react";
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
    // Exploración sin mesa: preferir PICKUP si está disponible.
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

  const confirmLabel = isSubmitting
    ? isAddition
      ? "Enviando adición…"
      : isPickupFlow
        ? "Enviando pedido para llevar…"
        : "Procesando pedido…"
    : isAddition
      ? "Enviar Adición a la Cocina"
      : isPickupFlow
        ? "Pedir para Llevar por WhatsApp"
        : "Confirmar pedido";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsOpen(true);
          }}
          className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-amber-500 px-5 py-4 font-semibold text-white shadow-lg shadow-amber-500/30 transition-transform active:scale-[0.98]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm tabular-nums">
              {count}
            </span>
            <span className="truncate">
              {isAddition
                ? `Adición · ${itemLabel}`
                : isPickupFlow
                  ? `Para llevar · ${itemLabel}`
                  : `Ver Pedido · ${itemLabel}`}
            </span>
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
          aria-label="Resumen del pedido"
          className="fixed inset-0 z-40 flex items-end justify-center"
        >
          <button
            type="button"
            aria-label="Cerrar resumen"
            disabled={isSubmitting}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm disabled:cursor-wait"
          />

          <div className="sheet-enter relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-2xl">
            <div
              aria-hidden
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20"
            />

            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <div>
                <h2 className="text-lg font-bold">
                  {isAddition
                    ? "Adición a tu mesa"
                    : isPickupFlow
                      ? "Pedido para llevar"
                      : "Tu pedido"}
                </h2>
                {isAddition && sessionTable ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Se suma a la cuenta · Mesa {sessionTable}
                  </p>
                ) : isPickupFlow ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Recoges en el local · te avisamos al teléfono
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
                className="text-sm font-medium text-red-500 transition-transform active:scale-95 disabled:opacity-40"
              >
                Vaciar
              </button>
            </div>

            <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-2">
              {orderedLines.map(({ product, quantity }) => (
                <li
                  key={product.uuid}
                  className="flex items-center gap-3 border-b border-black/5 pb-3 last:border-none dark:border-white/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs tabular-nums text-black/50 dark:text-white/50">
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

            <div className="space-y-3 border-t border-black/5 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 dark:border-white/10">
              {!isAddition && !tableLockedFromQr && orderTypes.length > 1 ? (
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">
                    Tipo de pedido
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {orderTypes.map((opt) => {
                      const active = orderType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setOrderType(opt.value)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                            active
                              ? "bg-amber-500 text-white"
                              : "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-black/50 dark:text-white/50">
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
                    className="rounded-xl bg-black/5 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-50 dark:bg-white/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-black/50 dark:text-white/50">
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
                    className="rounded-xl bg-black/5 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-50 dark:bg-white/10"
                  />
                </label>
              </div>

              {(isAddition || tableLockedFromQr || orderType === "IN_TABLE") ? (
                <div className="space-y-1.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-black/50 dark:text-white/50">
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
                      disabled={isSubmitting || tableLockedFromQr || isAddition}
                      onChange={(event) => setTableNumber(event.target.value)}
                      className="rounded-xl bg-black/5 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-70 dark:bg-white/10"
                    />
                  </label>
                  {tableLockedFromQr ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                        📍 {formatTableLabel(tableNumber || "")} (Detectada por
                        QR)
                      </span>
                      {onChangeTable ? (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={onChangeTable}
                          className="text-[11px] font-medium text-black/45 underline dark:text-white/45"
                        >
                          ¿No es tu mesa? Cambiar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isAddition && orderType === "DELIVERY" ? (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-black/50 dark:text-white/50">
                    Dirección de entrega
                  </span>
                  <input
                    type="text"
                    name="deliveryAddress"
                    autoComplete="street-address"
                    maxLength={255}
                    placeholder="Calle, número, colonia…"
                    value={deliveryAddress}
                    disabled={isSubmitting}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    className="rounded-xl bg-black/5 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-50 dark:bg-white/10"
                  />
                </label>
              ) : null}

              <div className="flex items-center justify-between text-base font-bold">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm leading-snug text-red-600 dark:text-red-400"
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
                className="w-full rounded-2xl bg-amber-500 px-5 py-4 font-semibold text-white shadow-lg shadow-amber-500/30 transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
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
