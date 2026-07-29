"use client";

/**
 * Carrito de compras local del comensal + sesión de orden activa (adiciones).
 * Persistido por tenant: al cambiar de restaurante se vacía el carrito ajeno.
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
  tableToken?: string | null;
}

interface CartState {
  /** Tenant al que pertenece el carrito persistido. */
  tenantSlug: string | null;
  lines: Record<string, CartLine>;
  activeOrderId: string | null;
  tableNumber: string | null;
  /** Token del QR (?t=); requerido para abrir/consultar cuenta IN_TABLE. */
  tableToken: string | null;
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
  setTableToken: (tableToken: string | null) => void;
  setTableAnchor: (tableNumber: string | null, tableToken: string | null) => void;
  /**
   * Ata el carrito al tenant actual.
   * Si había otro tenant con contenido, vacía líneas/sesión y devuelve true.
   */
  ensureTenant: (slug: string) => boolean;
}

const emptySession = {
  lines: {} as Record<string, CartLine>,
  activeOrderId: null as string | null,
  tableNumber: null as string | null,
  tableToken: null as string | null,
  customerName: null as string | null,
};

function hasCartContent(state: {
  lines: Record<string, CartLine>;
  activeOrderId: string | null;
  tableNumber: string | null;
}): boolean {
  return (
    Object.keys(state.lines).length > 0 ||
    Boolean(state.activeOrderId) ||
    Boolean(state.tableNumber)
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tenantSlug: null,
      ...emptySession,

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
          tableToken:
            session.tableToken !== undefined
              ? session.tableToken
              : get().tableToken,
        }),

      clearActiveOrderSession: () =>
        set({
          activeOrderId: null,
          tableNumber: null,
          tableToken: null,
          customerName: null,
        }),

      releaseActiveOrder: () =>
        set({
          activeOrderId: null,
          customerName: null,
        }),

      setTableNumber: (tableNumber) =>
        set({
          tableNumber,
          ...(tableNumber == null ? { tableToken: null } : {}),
        }),

      setTableToken: (tableToken) => set({ tableToken }),

      setTableAnchor: (tableNumber, tableToken) =>
        set({ tableNumber, tableToken }),

      ensureTenant: (slug) => {
        const normalized = slug.trim().toLowerCase();
        if (!normalized) return false;

        const state = get();
        if (state.tenantSlug === normalized) return false;

        // Migración: primer stamp sin tenant previo → conservar carrito.
        if (state.tenantSlug === null) {
          set({ tenantSlug: normalized });
          return false;
        }

        const cleared = hasCartContent(state);
        set({
          tenantSlug: normalized,
          ...emptySession,
        });
        return cleared;
      },
    }),
    {
      name: "platolisto-cart",
      partialize: (state) => ({
        tenantSlug: state.tenantSlug,
        lines: state.lines,
        activeOrderId: state.activeOrderId,
        tableNumber: state.tableNumber,
        tableToken: state.tableToken,
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
