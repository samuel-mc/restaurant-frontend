"use client";

/**
 * POS táctil full-screen del mesero: catálogo + cantidad/modificadores + envío a cocina.
 */

import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { Product } from "@/types/api";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { formatCurrency } from "@/lib/format";
import { getMenuByTenant } from "@/services/menuService";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { CART_ITEM_NOTES_MAX } from "@/store/cartStore";

export interface WaiterPosLine {
  key: string;
  productUuid: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
  modifierUuids: string[];
  modifierLabels: string[];
}

export interface WaiterPosDrawerProps {
  open: boolean;
  tenantSlug: string;
  tableNumber: string;
  /** Si hay cuenta abierta, se envía como adición. */
  activeOrderUuid?: string | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (lines: WaiterPosLine[]) => Promise<void>;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const NOTES_MAX = CART_ITEM_NOTES_MAX;

function lineKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function WaiterPosDrawer({
  open,
  tenantSlug,
  tableNumber,
  busy = false,
  onClose,
  onSubmit,
}: WaiterPosDrawerProps) {
  const titleId = useId();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<WaiterPosLine[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, string[]>
  >({});
  const [configError, setConfigError] = useState<string | null>(null);

  const panelRef = useModalFocusTrap({
    open,
    onEscape: () => {
      if (busy) return;
      if (configProduct) {
        setConfigProduct(null);
        return;
      }
      onClose();
    },
    escapeEnabled: !busy,
  });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCategory("ALL");
    setCart([]);
    setSubmitError(null);
    setConfigProduct(null);
    setMenuError(null);

    let cancelled = false;
    setLoadingMenu(true);
    void getMenuByTenant(tenantSlug)
      .then((menu) => {
        if (!cancelled) setProducts(menu.filter((p) => p.isAvailable));
      })
      .catch((err) => {
        if (!cancelled) {
          setMenuError(
            getAdminErrorMessage(err, "No se pudo cargar el menú."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMenu(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tenantSlug]);

  const categories = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of products) {
      names.set(String(p.categoryId), p.categoryName || "Sin categoría");
    }
    return Array.from(names.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "ALL" && String(p.categoryId) !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart],
  );

  if (!open) return null;

  function openProductConfig(product: Product) {
    setConfigError(null);
    setQty(1);
    setNotes("");
    const initial: Record<string, string[]> = {};
    for (const group of product.modifierGroups ?? []) {
      initial[group.uuid] = [];
    }
    setSelectedByGroup(initial);
    setConfigProduct(product);
  }

  function toggleOption(groupUuid: string, optionUuid: string, maxSelect: number) {
    setConfigError(null);
    setSelectedByGroup((prev) => {
      const current = prev[groupUuid] ?? [];
      if (current.includes(optionUuid)) {
        return {
          ...prev,
          [groupUuid]: current.filter((id) => id !== optionUuid),
        };
      }
      if (maxSelect <= 1) {
        return { ...prev, [groupUuid]: [optionUuid] };
      }
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupUuid]: [...current, optionUuid] };
    });
  }

  function addConfiguredLine() {
    if (!configProduct) return;
    const groups = configProduct.modifierGroups ?? [];
    for (const group of groups) {
      const count = (selectedByGroup[group.uuid] ?? []).length;
      if (count < group.minSelect || count > group.maxSelect) {
        setConfigError(
          `En “${group.name}” elige entre ${group.minSelect} y ${group.maxSelect} opción(es).`,
        );
        return;
      }
    }

    const modifierUuids: string[] = [];
    const modifierLabels: string[] = [];
    let unitPrice = configProduct.price;
    for (const group of groups) {
      for (const id of selectedByGroup[group.uuid] ?? []) {
        const opt = group.options.find((o) => o.uuid === id);
        if (!opt) continue;
        modifierUuids.push(opt.uuid);
        modifierLabels.push(opt.name);
        unitPrice += opt.priceDelta;
      }
    }

    const trimmed = notes.trim().slice(0, NOTES_MAX);
    setCart((prev) => [
      ...prev,
      {
        key: lineKey(),
        productUuid: configProduct.uuid,
        productName: configProduct.name,
        unitPrice,
        quantity: qty,
        notes: trimmed.length > 0 ? trimmed : null,
        modifierUuids,
        modifierLabels,
      },
    ]);
    setConfigProduct(null);
  }

  async function handleSubmit() {
    if (cart.length === 0) {
      setSubmitError("Agrega al menos un platillo.");
      return;
    }
    setSubmitError(null);
    try {
      await onSubmit(cart);
    } catch (err) {
      setSubmitError(
        getAdminErrorMessage(err, "No se pudo enviar la comanda."),
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div ref={panelRef} className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Volver"
            className={`inline-flex size-11 items-center justify-center rounded-xl border border-border bg-secondary ${focusRing}`}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-lg font-bold tracking-tight">
              Mesa {tableNumber}
            </h2>
            <p className="text-xs text-muted-foreground">
              Toma de comanda · envío a cocina
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className={`inline-flex size-11 items-center justify-center rounded-xl ${focusRing}`}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar platillo…"
              className={`${focusRing} min-h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-base`}
            />
          </label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setCategory("ALL")}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${focusRing} ${
                category === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              }`}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${focusRing} ${
                  category === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-36">
          {loadingMenu ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Cargando menú…
            </p>
          ) : menuError ? (
            <p role="alert" className="py-6 text-center text-sm text-destructive">
              {menuError}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sin productos para este filtro.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((product) => (
                <li key={product.uuid}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openProductConfig(product)}
                    className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left ${focusRing}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {product.categoryName}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {product.formattedPrice}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {cart.length > 0 ? (
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Comanda ({cart.length})
              </h3>
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li
                    key={line.key}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {line.quantity}× {line.productName}
                      </p>
                      {line.modifierLabels.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {line.modifierLabels.join(" · ")}
                        </p>
                      ) : null}
                      {line.notes ? (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">
                          {line.notes}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm font-bold tabular-nums">
                        {formatCurrency(line.unitPrice * line.quantity)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Quitar ${line.productName}`}
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((item) => item.key !== line.key),
                        )
                      }
                      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-destructive ${focusRing}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {submitError ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {submitError}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[81] p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={busy || cart.length === 0}
            onClick={() => void handleSubmit()}
            className={`pointer-events-auto mx-auto flex min-h-14 w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-live px-4 text-base font-bold text-live-foreground shadow-lg ${focusRing} disabled:opacity-50`}
          >
            <Send className="size-5" aria-hidden />
            {busy
              ? "Enviando…"
              : `Enviar Comanda a Cocina · ${formatCurrency(cartTotal)}`}
          </button>
        </div>
      </div>

      {configProduct ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4">
          <div className="flex max-h-[min(90dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold">{configProduct.name}</h3>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {configProduct.formattedPrice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigProduct(null)}
                aria-label="Cerrar"
                className={`inline-flex size-10 items-center justify-center rounded-xl ${focusRing}`}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Menos"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className={`inline-flex size-12 items-center justify-center rounded-xl border border-border bg-secondary ${focusRing}`}
                >
                  <Minus className="size-5" aria-hidden />
                </button>
                <span className="min-w-10 text-center text-2xl font-bold tabular-nums">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Más"
                  onClick={() => setQty((n) => Math.min(99, n + 1))}
                  className={`inline-flex size-12 items-center justify-center rounded-xl border border-border bg-secondary ${focusRing}`}
                >
                  <Plus className="size-5" aria-hidden />
                </button>
              </div>

              {(configProduct.modifierGroups ?? []).map((group) => (
                <fieldset key={group.uuid}>
                  <legend className="mb-2 text-sm font-semibold">
                    {group.name}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({group.minSelect}-{group.maxSelect})
                    </span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {group.options
                      .filter((o) => o.available)
                      .map((opt) => {
                        const selected = (
                          selectedByGroup[group.uuid] ?? []
                        ).includes(opt.uuid);
                        return (
                          <button
                            key={opt.uuid}
                            type="button"
                            onClick={() =>
                              toggleOption(
                                group.uuid,
                                opt.uuid,
                                group.maxSelect,
                              )
                            }
                            className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${focusRing} ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-secondary"
                            }`}
                          >
                            {opt.name}
                            {opt.priceDelta > 0
                              ? ` · +${opt.formattedPriceDelta}`
                              : ""}
                          </button>
                        );
                      })}
                  </div>
                </fieldset>
              ))}

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">
                  Notas (ej. Sin picante)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value.slice(0, NOTES_MAX))
                  }
                  rows={2}
                  maxLength={NOTES_MAX}
                  placeholder="Sin picante, poco sal…"
                  className={`${focusRing} w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm`}
                />
              </label>

              {configError ? (
                <p role="alert" className="text-sm text-destructive">
                  {configError}
                </p>
              ) : null}
            </div>
            <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={addConfiguredLine}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground ${focusRing}`}
              >
                <Plus className="size-4" aria-hidden />
                Agregar a la comanda
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
