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
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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

/** Resumen de la cuenta abierta al tomar una adición (evita memoria del mesero). */
export interface WaiterPosOpenAccount {
  statusLabel: string;
  formattedTotal: string;
  items: Array<{ quantity: number; productName: string }>;
}

export interface WaiterPosDrawerProps {
  open: boolean;
  tenantSlug: string;
  tableNumber: string;
  /** Si hay cuenta abierta, se envía como adición. */
  activeOrderUuid?: string | null;
  /** Líneas ya pedidas en esa cuenta (solo adición). */
  openAccount?: WaiterPosOpenAccount | null;
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
  activeOrderUuid = null,
  openAccount = null,
  busy = false,
  onClose,
  onSubmit,
}: WaiterPosDrawerProps) {
  const titleId = useId();
  const isAddition = Boolean(activeOrderUuid);
  const modeLabel = isAddition ? "Adición" : "Nueva cuenta";
  const modeHint = isAddition
    ? "Se suma a la cuenta abierta · envío a cocina"
    : "Abre la cuenta de esta mesa · envío a cocina";
  const cartHeading = isAddition ? "Esta adición" : "Comanda nueva";
  const addLineLabel = isAddition
    ? "Agregar a la adición"
    : "Agregar a la comanda";
  const sendLabel = isAddition
    ? "Enviar adición a cocina"
    : "Enviar comanda a cocina";
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
  const [menuEpoch, setMenuEpoch] = useState(0);
  const [discardKind, setDiscardKind] = useState<"cart" | "config" | null>(
    null,
  );

  function isConfigDirty(): boolean {
    if (qty !== 1) return true;
    if (notes.trim().length > 0) return true;
    return Object.values(selectedByGroup).some((ids) => ids.length > 0);
  }

  function closeConfigSheet() {
    if (isConfigDirty()) {
      setDiscardKind("config");
      return;
    }
    setConfigError(null);
    setConfigProduct(null);
  }

  function requestClose() {
    if (busy) return;
    if (configProduct) {
      closeConfigSheet();
      return;
    }
    if (cart.length > 0) {
      setDiscardKind("cart");
      return;
    }
    onClose();
  }

  function confirmDiscard() {
    if (discardKind === "config") {
      setDiscardKind(null);
      setConfigError(null);
      setConfigProduct(null);
      return;
    }
    setDiscardKind(null);
    setCart([]);
    onClose();
  }

  const panelRef = useModalFocusTrap({
    open: open && discardKind === null,
    onEscape: requestClose,
    escapeEnabled: !busy && discardKind === null,
  });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCategory("ALL");
    setCart([]);
    setSubmitError(null);
    setConfigProduct(null);
    setDiscardKind(null);
  }, [open, tenantSlug]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingMenu(true);
    setMenuError(null);
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
  }, [open, tenantSlug, menuEpoch]);

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
      setSubmitError(
        isAddition
          ? "Agrega al menos un platillo a esta adición."
          : "Agrega al menos un platillo a la comanda.",
      );
      return;
    }
    setSubmitError(null);
    try {
      await onSubmit(cart);
    } catch (err) {
      setSubmitError(
        getAdminErrorMessage(
          err,
          isAddition
            ? "No se pudo enviar la adición. Revisa la conexión e inténtalo de nuevo."
            : "No se pudo enviar la comanda. Revisa la conexión e inténtalo de nuevo.",
        ),
      );
    }
  }

  const openAccountPreview = openAccount?.items.slice(0, 4) ?? [];
  const openAccountExtra =
    openAccount && openAccount.items.length > openAccountPreview.length
      ? openAccount.items.length - openAccountPreview.length
      : 0;

  function renderOpenAccount() {
    if (!isAddition || !openAccount) return null;
    return (
      <section aria-label="Cuenta abierta" className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ya en esta cuenta
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {openAccount.statusLabel}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {openAccount.formattedTotal}
              </span>
            </p>
          </div>
        </div>
        {openAccountPreview.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            {openAccountPreview.map((item, index) => (
              <li key={`${item.productName}-${index}`} className="truncate">
                <span className="font-semibold tabular-nums text-foreground">
                  {item.quantity}×
                </span>{" "}
                {item.productName}
              </li>
            ))}
            {openAccountExtra > 0 ? (
              <li className="text-xs">y {openAccountExtra} más</li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Sin platillos listados aún. Lo que agregues es la adición.
          </p>
        )}
      </section>
    );
  }

  function renderCartLines() {
    if (cart.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAddition
            ? "Toca un platillo para sumarlo a esta adición."
            : "Toca un platillo para armar la comanda."}
        </p>
      );
    }
    return (
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
                setCart((prev) => prev.filter((item) => item.key !== line.key))
              }
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-destructive ${focusRing}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function renderSendButton() {
    return (
      <button
        type="button"
        disabled={busy || cart.length === 0}
        onClick={() => void handleSubmit()}
        className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-bold text-primary-foreground shadow-lg ${focusRing} disabled:opacity-50`}
      >
        <Send className="size-5" aria-hidden />
        {busy ? "Enviando…" : `${sendLabel} · ${formatCurrency(cartTotal)}`}
      </button>
    );
  }

  const openAccountMobile = renderOpenAccount();
  const openAccountDesktop = renderOpenAccount();

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
            onClick={requestClose}
            disabled={busy}
            aria-label="Cerrar"
            className={`inline-flex size-11 items-center justify-center rounded-xl border border-border bg-secondary ${focusRing}`}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2
                id={titleId}
                className="truncate text-lg font-bold tracking-tight"
              >
                Mesa {tableNumber}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isAddition
                    ? "bg-secondary text-foreground ring-1 ring-foreground/20"
                    : "bg-secondary text-muted-foreground ring-1 ring-border"
                }`}
              >
                {modeLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{modeHint}</p>
          </div>
        </header>

        {/* Phone: account strip above catalog. md+: lives in comanda column. */}
        {openAccountMobile ? (
          <div className="shrink-0 border-b border-border bg-secondary/40 md:hidden">
            {openAccountMobile}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Catalog */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
              <label className="relative block">
                <span className="sr-only">Buscar platillo</span>
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
              <div
                role="group"
                aria-label="Categorías del menú"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
              >
                <button
                  type="button"
                  onClick={() => setCategory("ALL")}
                  aria-pressed={category === "ALL"}
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
                    aria-pressed={category === cat.id}
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-36 md:pb-4">
              {loadingMenu ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Cargando menú…
                </p>
              ) : menuError ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p role="alert" className="text-sm text-destructive">
                    {menuError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMenuEpoch((epoch) => epoch + 1)}
                    className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-secondary px-4 text-sm font-semibold ${focusRing}`}
                  >
                    Reintentar menú
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No hay platillos con ese filtro. Prueba otra categoría o limpia
                  la búsqueda.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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

              {/* Phone: comanda under catalog */}
              <section className="mt-6 md:hidden" aria-label={cartHeading}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {cartHeading}
                  {cart.length > 0 ? (
                    <span className="ml-1.5 font-semibold normal-case tracking-normal tabular-nums text-foreground">
                      {cart.length}
                    </span>
                  ) : null}
                </h3>
                {renderCartLines()}
                {submitError ? (
                  <p
                    role="alert"
                    className="mt-4 text-sm font-medium text-destructive"
                  >
                    {submitError}
                  </p>
                ) : null}
              </section>
            </div>

            {/* Phone: thumb-reach send */}
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[81] p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:hidden">
              <div className="pointer-events-auto mx-auto w-full max-w-lg">
                {cart.length > 0 ? (
                  <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">
                    {cart.length} platillo{cart.length === 1 ? "" : "s"} en{" "}
                    {cartHeading.toLowerCase()} · edita arriba
                  </p>
                ) : null}
                {renderSendButton()}
              </div>
            </div>
          </div>

          {/* Tablet/desktop: comanda column — cart + send always visible */}
          <aside
            className="hidden min-h-0 w-full max-w-md flex-col border-l border-border bg-card md:flex md:w-[min(22rem,40%)]"
            aria-label={cartHeading}
          >
            {openAccountDesktop ? (
              <div className="shrink-0 border-b border-border bg-secondary/40">
                {openAccountDesktop}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {cartHeading}
                {cart.length > 0 ? (
                  <span className="ml-1.5 font-semibold normal-case tracking-normal tabular-nums text-foreground">
                    {cart.length}
                  </span>
                ) : null}
              </h3>
              {renderCartLines()}
              {submitError ? (
                <p
                  role="alert"
                  className="mt-4 text-sm font-medium text-destructive"
                >
                  {submitError}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              {renderSendButton()}
            </div>
          </aside>
        </div>
      </div>

      {configProduct ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) closeConfigSheet();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-product-config-title"
            className="flex max-h-[min(90dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
              <div className="min-w-0">
                <h3
                  id="pos-product-config-title"
                  className="truncate text-lg font-bold"
                >
                  {configProduct.name}
                </h3>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {configProduct.formattedPrice}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfigSheet}
                aria-label="Cerrar platillo"
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
                  Notas para cocina
                </span>
                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value.slice(0, NOTES_MAX))
                  }
                  rows={2}
                  maxLength={NOTES_MAX}
                  placeholder="Ej. Sin picante, poco sal…"
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
                {addLineLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={discardKind !== null}
        title={
          discardKind === "config"
            ? "¿Descartar este platillo?"
            : "¿Salir sin enviar?"
        }
        description={
          discardKind === "config"
            ? "Hay opciones o notas sin agregar al carrito. Si cierras, se pierden."
            : isAddition
              ? `Tienes ${cart.length} platillo${cart.length === 1 ? "" : "s"} en esta adición. Si sales, se perderán.`
              : `Tienes ${cart.length} platillo${cart.length === 1 ? "" : "s"} en la comanda. Si sales, se perderán.`
        }
        confirmLabel={
          discardKind === "config" ? "Descartar" : "Salir sin enviar"
        }
        cancelLabel={
          discardKind === "config" ? "Seguir eligiendo" : "Seguir editando"
        }
        tone="danger"
        overlayClassName="z-[100]"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardKind(null)}
      />
    </div>
  );
}
