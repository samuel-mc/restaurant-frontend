"use client";

/**
 * Carrito de compras local del comensal + sesión de orden activa (adiciones).
 * Persistido por tenant: al cambiar de restaurante se vacía el carrito ajeno.
 *
 * Clave de línea: producto + modificadores ordenados + notas
 * (permite el mismo platillo con extras distintos).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/api";

export interface CartSelectedModifier {
  uuid: string;
  name: string;
  priceDelta: number;
}

/** Línea del carrito: producto, cantidad, notas y modificadores. */
export interface CartLine {
  /** Clave estable (producto + mods + notas). */
  key: string;
  product: Product;
  quantity: number;
  notes: string | null;
  modifiers: CartSelectedModifier[];
}

/** Sesión de mesa: permite enviar adiciones al mismo ticket. */
export interface ActiveOrderSession {
  activeOrderId: string;
  tableNumber: string;
  customerName: string;
  tableToken?: string | null;
}

interface CartState {
  tenantSlug: string | null;
  lines: Record<string, CartLine>;
  activeOrderId: string | null;
  tableNumber: string | null;
  tableToken: string | null;
  customerName: string | null;
  addItem: (
    product: Product,
    options?: {
      notes?: string | null;
      modifiers?: CartSelectedModifier[];
    },
  ) => void;
  /** Decrementa por clave de línea. */
  decrementItem: (lineKey: string) => void;
  /** Decrementa cualquier línea del producto (para el stepper del menú). */
  decrementProduct: (productUuid: string) => void;
  removeItem: (lineKey: string) => void;
  setLineNotes: (lineKey: string, notes: string | null) => void;
  clear: () => void;
  setActiveOrderSession: (session: ActiveOrderSession) => void;
  clearActiveOrderSession: () => void;
  releaseActiveOrder: () => void;
  setTableNumber: (tableNumber: string | null) => void;
  setTableToken: (tableToken: string | null) => void;
  setTableAnchor: (tableNumber: string | null, tableToken: string | null) => void;
  ensureTenant: (slug: string) => boolean;
}

const emptySession = {
  lines: {} as Record<string, CartLine>,
  activeOrderId: null as string | null,
  tableNumber: null as string | null,
  tableToken: null as string | null,
  customerName: null as string | null,
};

export const CART_ITEM_NOTES_MAX = 255;

function normalizeNotes(notes: string | null | undefined): string | null {
  if (notes == null) return null;
  const trimmed = notes.trim().slice(0, CART_ITEM_NOTES_MAX);
  return trimmed.length > 0 ? trimmed : null;
}

function coerceNotesInput(notes: string | null | undefined): string | null {
  if (notes == null) return null;
  const sliced = notes.slice(0, CART_ITEM_NOTES_MAX);
  return sliced.length > 0 ? sliced : null;
}

function normalizeModifiers(
  modifiers: CartSelectedModifier[] | undefined,
): CartSelectedModifier[] {
  if (!modifiers || modifiers.length === 0) return [];
  return [...modifiers]
    .filter((m) => m.uuid)
    .sort((a, b) => a.uuid.localeCompare(b.uuid))
    .map((m) => ({
      uuid: m.uuid,
      name: m.name,
      priceDelta: Number.isFinite(m.priceDelta) ? m.priceDelta : 0,
    }));
}

export function buildCartLineKey(
  productUuid: string,
  modifiers: CartSelectedModifier[],
  notes: string | null,
): string {
  const mods = normalizeModifiers(modifiers)
    .map((m) => m.uuid)
    .join(",");
  const n = notes ?? "";
  return `${productUuid}::${mods}::${n}`;
}

export function cartLineUnitPrice(line: CartLine): number {
  const extras = line.modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
  return line.product.price + extras;
}

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

/** Migra líneas legacy keyed solo por product.uuid. */
function migrateLines(
  raw: Record<string, CartLine | { product: Product; quantity: number; notes: string | null }>,
): Record<string, CartLine> {
  const next: Record<string, CartLine> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (!value || typeof value !== "object" || !("product" in value)) continue;
    const product = value.product as Product;
    const quantity = Number((value as CartLine).quantity) || 0;
    if (!product?.uuid || quantity <= 0) continue;
    const notes = normalizeNotes((value as CartLine).notes);
    const modifiers = normalizeModifiers((value as CartLine).modifiers);
    const lineKey =
      (value as CartLine).key ||
      (key.includes("::") ? key : buildCartLineKey(product.uuid, modifiers, notes));
    const existing = next[lineKey];
    if (existing) {
      next[lineKey] = {
        ...existing,
        quantity: existing.quantity + quantity,
      };
    } else {
      next[lineKey] = {
        key: lineKey,
        product,
        quantity,
        notes,
        modifiers,
      };
    }
  }
  return next;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      tenantSlug: null,
      ...emptySession,

      addItem: (product, options) =>
        set((state) => {
          const notes =
            options && "notes" in options
              ? normalizeNotes(options.notes)
              : null;
          const modifiers = normalizeModifiers(options?.modifiers);
          // Si no se pasan opciones y ya hay una línea simple del producto, incrementa esa.
          if (!options || (!("notes" in options) && !options.modifiers)) {
            const simpleKey = buildCartLineKey(product.uuid, [], null);
            const existingSimple = state.lines[simpleKey];
            if (existingSimple) {
              return {
                lines: {
                  ...state.lines,
                  [simpleKey]: {
                    ...existingSimple,
                    quantity: existingSimple.quantity + 1,
                  },
                },
              };
            }
            // Buscar cualquier línea del producto sin forzar notas/mods nuevas.
            const anyLine = Object.values(state.lines).find(
              (l) => l.product.uuid === product.uuid,
            );
            if (anyLine && anyLine.modifiers.length === 0 && !anyLine.notes) {
              return {
                lines: {
                  ...state.lines,
                  [anyLine.key]: {
                    ...anyLine,
                    quantity: anyLine.quantity + 1,
                  },
                },
              };
            }
          }

          const lineKey = buildCartLineKey(product.uuid, modifiers, notes);
          const existing = state.lines[lineKey];
          return {
            lines: {
              ...state.lines,
              [lineKey]: {
                key: lineKey,
                product,
                quantity: (existing?.quantity ?? 0) + 1,
                notes: existing?.notes ?? notes,
                modifiers: existing?.modifiers?.length ? existing.modifiers : modifiers,
              },
            },
          };
        }),

      decrementItem: (lineKey) =>
        set((state) => {
          const existing = state.lines[lineKey];
          if (!existing) return state;
          const nextLines = { ...state.lines };
          if (existing.quantity <= 1) {
            delete nextLines[lineKey];
          } else {
            nextLines[lineKey] = {
              ...existing,
              quantity: existing.quantity - 1,
            };
          }
          return { lines: nextLines };
        }),

      decrementProduct: (productUuid) =>
        set((state) => {
          const candidates = Object.values(state.lines)
            .filter((l) => l.product.uuid === productUuid)
            .sort((a, b) => b.key.localeCompare(a.key));
          const target = candidates[0];
          if (!target) return state;
          const nextLines = { ...state.lines };
          if (target.quantity <= 1) {
            delete nextLines[target.key];
          } else {
            nextLines[target.key] = {
              ...target,
              quantity: target.quantity - 1,
            };
          }
          return { lines: nextLines };
        }),

      removeItem: (lineKey) =>
        set((state) => {
          if (!state.lines[lineKey]) return state;
          const nextLines = { ...state.lines };
          delete nextLines[lineKey];
          return { lines: nextLines };
        }),

      setLineNotes: (lineKey, notes) =>
        set((state) => {
          const existing = state.lines[lineKey];
          if (!existing) return state;
          const nextNotes = coerceNotesInput(notes);
          const normalized = normalizeNotes(nextNotes);
          const nextKey = buildCartLineKey(
            existing.product.uuid,
            existing.modifiers,
            normalized,
          );
          const nextLines = { ...state.lines };
          delete nextLines[lineKey];
          const collide = nextLines[nextKey];
          nextLines[nextKey] = {
            key: nextKey,
            product: existing.product,
            quantity: existing.quantity + (collide?.quantity ?? 0),
            notes: nextNotes,
            modifiers: existing.modifiers,
          };
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
      version: 2,
      migrate: (persisted) => {
        const state = persisted as {
          lines?: Record<string, CartLine>;
          tenantSlug?: string | null;
          activeOrderId?: string | null;
          tableNumber?: string | null;
          tableToken?: string | null;
          customerName?: string | null;
        } | null;
        if (!state) return state as never;
        return {
          ...state,
          lines: migrateLines(state.lines ?? {}),
        } as never;
      },
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

/**
 * Espera la rehidratación de localStorage sin tocar `persist` en el render
 * (en SSR de Next a veces `useCartStore.persist` no está listo → TypeError).
 */
export function subscribeCartHydration(onReady: () => void): () => void {
  const api = useCartStore.persist;
  if (!api?.hasHydrated || !api.onFinishHydration) {
    onReady();
    return () => undefined;
  }
  if (api.hasHydrated()) {
    onReady();
  }
  return api.onFinishHydration(onReady);
}

export const useCartCount = (): number =>
  useCartStore((state) =>
    Object.values(state.lines).reduce((total, line) => total + line.quantity, 0),
  );

export const useCartSubtotal = (): number =>
  useCartStore((state) =>
    Object.values(state.lines).reduce(
      (total, line) => total + cartLineUnitPrice(line) * line.quantity,
      0,
    ),
  );

export const useProductQuantity = (productUuid: string): number =>
  useCartStore((state) =>
    Object.values(state.lines)
      .filter((line) => line.product.uuid === productUuid)
      .reduce((sum, line) => sum + line.quantity, 0),
  );

export const useHasActiveOrder = (): boolean =>
  useCartStore((state) => Boolean(state.activeOrderId));
