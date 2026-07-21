"use client";

/**
 * Carrito de compras local del comensal.
 *
 * Estado global ligero (Zustand) que vive solo en cliente. Guarda las líneas
 * seleccionadas indexadas por `uuid` de producto, permite ajustar cantidades y
 * expone selectores derivados (conteo y subtotal) calculados en tiempo real.
 *
 * Persistido en `localStorage` por origen (subdominio del tenant).
 *
 * Los precios se operan como `number` (regla de arquitectura); el formateo de
 * moneda se hace en UI con `formatCurrency`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/api";

/** Línea del carrito: el producto y su cantidad. */
export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartState {
  /** Líneas indexadas por `product.uuid` (acceso O(1) y referencia estable). */
  lines: Record<string, CartLine>;
  /** Agrega una unidad del producto (o crea la línea si no existe). */
  addItem: (product: Product) => void;
  /** Resta una unidad; elimina la línea al llegar a 0. */
  decrementItem: (uuid: string) => void;
  /** Elimina por completo una línea. */
  removeItem: (uuid: string) => void;
  /** Vacía el carrito. */
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: {},

      addItem: (product) =>
        set((state) => {
          const existing = state.lines[product.uuid];
          return {
            lines: {
              ...state.lines,
              [product.uuid]: {
                product,
                quantity: (existing?.quantity ?? 0) + 1,
              },
            },
          };
        }),

      decrementItem: (uuid) =>
        set((state) => {
          const existing = state.lines[uuid];
          if (!existing) return state;

          const nextLines = { ...state.lines };
          if (existing.quantity <= 1) {
            delete nextLines[uuid];
          } else {
            nextLines[uuid] = { ...existing, quantity: existing.quantity - 1 };
          }
          return { lines: nextLines };
        }),

      removeItem: (uuid) =>
        set((state) => {
          if (!state.lines[uuid]) return state;
          const nextLines = { ...state.lines };
          delete nextLines[uuid];
          return { lines: nextLines };
        }),

      clear: () => set({ lines: {} }),
    }),
    {
      name: "platolisto-cart",
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/* ----------------------------- Selectores ------------------------------- */

/** Cantidad total de unidades en el carrito. */
export const useCartCount = (): number =>
  useCartStore((state) =>
    Object.values(state.lines).reduce((total, line) => total + line.quantity, 0),
  );

/** Subtotal exacto (suma de precio × cantidad de cada línea). */
export const useCartSubtotal = (): number =>
  useCartStore((state) =>
    Object.values(state.lines).reduce(
      (total, line) => total + line.product.price * line.quantity,
      0,
    ),
  );

/** Cantidad de un producto puntual (0 si no está en el carrito). */
export const useProductQuantity = (uuid: string): number =>
  useCartStore((state) => state.lines[uuid]?.quantity ?? 0);
