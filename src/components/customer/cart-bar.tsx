"use client";

/**
 * Botón flotante del carrito + hoja inferior (bottom sheet) con el resumen.
 *
 * El botón solo aparece si hay al menos un producto. Al pulsarlo abre un modal
 * inferior con las líneas, permite ajustar cantidades y muestra el subtotal en
 * tiempo real antes de confirmar el pedido.
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

  // Cierra la hoja automáticamente si el carrito queda vacío.
  useEffect(() => {
    if (count === 0) setIsOpen(false);
  }, [count]);

  // Evita el scroll del fondo mientras la hoja está abierta.
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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto flex w-full items-center justify-between rounded-2xl bg-amber-500 px-5 py-4 font-semibold text-white shadow-lg shadow-amber-500/30 transition-transform active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-sm tabular-nums">
              {count}
            </span>
            Ver pedido
          </span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </button>
      </div>

      {/* Hoja inferior con el resumen */}
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
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-lg font-bold">Tu pedido</h2>
              <button
                type="button"
                onClick={clear}
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
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {formatCurrency(product.price * quantity)}
                    </p>
                  </div>
                  <QuantityStepper
                    quantity={quantity}
                    label={product.name}
                    onIncrement={() => addItem(product)}
                    onDecrement={() => decrementItem(product.uuid)}
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
