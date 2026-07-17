"use client";

/**
 * Botón flotante del carrito + drawer inferior (bottom sheet) con el resumen.
 *
 * Visible solo si `totalItems > 0`. Al abrirlo muestra el desglose del pedido
 * y el CTA destacado "Confirmar pedido".
 */

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import {
  useCartCount,
  useCartStore,
  useCartSubtotal,
} from "@/store/cartStore";
import { QuantityStepper } from "@/components/customer/quantity-stepper";

export function CartBar() {
  const [isOpen, setIsOpen] = useState(false);
  const count = useCartCount();
  const subtotal = useCartSubtotal();
  const lines = useCartStore((state) => state.lines);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const clear = useCartStore((state) => state.clear);

  const orderedLines = useMemo(() => Object.values(lines), [lines]);
  const itemLabel = count === 1 ? "1 ítem" : `${count} ítems`;

  // Evita el scroll del fondo mientras el drawer está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (count === 0) return null;

  return (
    <>
      {/* Botón flotante inferior */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-amber-500 px-5 py-4 font-semibold text-white shadow-lg shadow-amber-500/30 transition-transform active:scale-[0.98]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm tabular-nums">
              {count}
            </span>
            <span className="truncate">Ver Pedido · {itemLabel}</span>
          </span>
          <span className="shrink-0 tabular-nums">
            {formatCurrency(subtotal)}
          </span>
        </button>
      </div>

      {/* Drawer inferior con el resumen */}
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
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <div className="sheet-enter relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-2xl">
            <div
              aria-hidden
              className="mx-auto mt-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20"
            />

            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="text-lg font-bold">Tu pedido</h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  clear();
                }}
                className="text-sm font-medium text-red-500 transition-transform active:scale-95"
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
              <div className="flex items-center justify-between text-base font-bold">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <button
                type="button"
                className="w-full rounded-2xl bg-amber-500 px-5 py-4 font-semibold text-white shadow-lg shadow-amber-500/30 transition-transform active:scale-[0.98]"
              >
                Confirmar pedido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
