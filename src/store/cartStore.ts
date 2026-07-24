"use client";

/**
 * Carrito de compras local del comensal + sesión de orden activa (adiciones).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/api";

/** Línea del carrito: el producto y su cantidad. */
export interface CartLine {
  product: Product;
  quantity: number;
}

/** Sesión de mesa: permite enviar adiciones al mismo ticket. */
export interface ActiveOrderSession {
  activeOrderId: string;
  tableNumber: string;
  customerName: string;
}

interface CartState {
  lines: Record<string, CartLine>;
  activeOrderId: string | null;
  tableNumber: string | null;
  customerName: string | null;
  addItem: (product: Product) => void;
  decrementItem: (uuid: string) => void;
  removeItem: (uuid: string) => void;
  clear: () => void;
  setActiveOrderSession: (session: ActiveOrderSession) => void;
  clearActiveOrderSession: () => void;
  /** Libera el ticket activo pero conserva la mesa anclada (QR). */
  releaseActiveOrder: () => void;
  setTableNumber: (tableNumber: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      activeOrderId: null,
      tableNumber: null,
      customerName: null,

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

      setActiveOrderSession: (session) =>
        set({
          activeOrderId: session.activeOrderId,
          tableNumber: session.tableNumber,
          customerName: session.customerName,
        }),

      clearActiveOrderSession: () =>
        set({
          activeOrderId: null,
          tableNumber: null,
          customerName: null,
        }),

      releaseActiveOrder: () =>
        set({
          activeOrderId: null,
          customerName: null,
        }),

      setTableNumber: (tableNumber) => set({ tableNumber }),
    }),
    {
      name: "platolisto-cart",
      partialize: (state) => ({
        lines: state.lines,
        activeOrderId: state.activeOrderId,
        tableNumber: state.tableNumber,
        customerName: state.customerName,
      }),
    },
  ),
);

export const useCartCount = (): number =>
  useCartStore((state) =>
    Object.values(state.lines).reduce((total, line) => total + line.quantity, 0),
  );

export const useCartSubtotal = (): number =>
  useCartStore((state) =>
    Object.values(state.lines).reduce(
      (total, line) => total + line.product.price * line.quantity,
      0,
    ),
  );

export const useProductQuantity = (uuid: string): number =>
  useCartStore((state) => state.lines[uuid]?.quantity ?? 0);

export const useHasActiveOrder = (): boolean =>
  useCartStore((state) => Boolean(state.activeOrderId));
