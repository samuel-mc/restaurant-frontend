"use client";

/**
 * Botón flotante del carrito + drawer: pedido nuevo o adición a mesa.
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

function resolveOrderTypes(modules: OrderModules | undefined): OrderTypeOption[] {
  const options: OrderTypeOption[] = [
    { value: "IN_TABLE", label: "En mesa" },
  ];
  if (modules?.hasPickup) {
    options.push({ value: "PICKUP", label: "Para llevar" });
  }
  if (modules?.hasDelivery) {
    options.push({ value: "DELIVERY", label: "Delivery" });
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
  const orderTypes = useMemo(() => resolveOrderTypes(modules), [modules]);
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderType, setOrderType] = useState<OrderType>(
    () => orderTypes[0]?.value ?? "IN_TABLE",
  );
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
  const orderedLines = useMemo(() => Object.values(lines), [lines]);
  const itemLabel = count === 1 ? "1 ítem" : `${count} ítems`;

  useEffect(() => {
    if (!orderTypes.some((opt) => opt.value === orderType)) {
      setOrderType(orderTypes[0]?.value ?? "IN_TABLE");
    }
  }, [orderTypes, orderType]);

  useEffect(() => {
    if (isAddition || tableLockedFromQr) {
      setOrderType("IN_TABLE");
      if (sessionTable) setTableNumber(sessionTable);
      if (sessionName) setCustomerName(sessionName);
    }
  }, [isAddition, tableLockedFromQr, sessionTable, sessionName]);

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

    if (effectiveType === "IN_TABLE" && !effectiveTable && !isAddition) {
      setErrorMessage("Indica el número de mesa para tu pedido.");
      return;
    }
    if (isAddition && !activeOrderId) {
      setErrorMessage("No hay una orden activa para agregar platillos.");
      return;
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
      customerName: customerName.trim() || sessionName || null,
      customerPhone: customerPhone.trim() || null,
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
      : "Procesando pedido…"
    : isAddition
      ? "Enviar Adición a la Cocina"
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
              {isAddition ? `Adición · ${itemLabel}` : `Ver Pedido · ${itemLabel}`}
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
                  {isAddition ? "Adición a tu mesa" : "Tu pedido"}
                </h2>
                {isAddition && sessionTable ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Se suma a la cuenta · Mesa {sessionTable}
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

              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-black/50 dark:text-white/50">
                    Tu nombre
                  </span>
                  <input
                    type="text"
                    name="customerName"
                    autoComplete="name"
                    maxLength={100}
                    placeholder="Opcional"
                    value={customerName}
                    disabled={isSubmitting}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="rounded-xl bg-black/5 px-3 py-2.5 text-sm outline-none ring-amber-500/40 focus:ring-2 disabled:opacity-50 dark:bg-white/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-black/50 dark:text-white/50">
                    Teléfono
                  </span>
                  <input
                    type="tel"
                    name="customerPhone"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder={
                      orderType === "DELIVERY" ? "Recomendado" : "Opcional"
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
