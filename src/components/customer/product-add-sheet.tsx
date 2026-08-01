"use client";

/**
 * Sheet al agregar un platillo: modificadores con precio + notas opcionales.
 */

import { useEffect, useId, useMemo, useState } from "react";
import type { Product } from "@/types/api";
import {
  CART_ITEM_NOTES_MAX,
  type CartSelectedModifier,
} from "@/store/cartStore";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { formatCurrency } from "@/lib/format";

interface ProductAddSheetProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onConfirm: (
    notes: string | null,
    modifiers: CartSelectedModifier[],
  ) => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const fieldClass = `${focusRing} min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground`;

export function ProductAddSheet({
  product,
  open,
  onClose,
  onConfirm,
}: ProductAddSheetProps) {
  const titleId = useId();
  const notesId = useId();
  const [notes, setNotes] = useState("");
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, string[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onClose,
  });

  const groups = product.modifierGroups ?? [];

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setError(null);
    const initial: Record<string, string[]> = {};
    for (const group of product.modifierGroups ?? []) {
      initial[group.uuid] = [];
    }
    setSelectedByGroup(initial);
  }, [open, product.uuid, product.modifierGroups]);

  const selectedModifiers = useMemo(() => {
    const selected: CartSelectedModifier[] = [];
    for (const group of groups) {
      const ids = selectedByGroup[group.uuid] ?? [];
      for (const id of ids) {
        const opt = group.options.find((o) => o.uuid === id);
        if (opt) {
          selected.push({
            uuid: opt.uuid,
            name: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      }
    }
    return selected;
  }, [groups, selectedByGroup]);

  const unitPrice =
    product.price +
    selectedModifiers.reduce((sum, m) => sum + m.priceDelta, 0);

  if (!open) return null;

  function toggleOption(groupUuid: string, optionUuid: string, maxSelect: number) {
    setError(null);
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
      if (current.length >= maxSelect) {
        return prev;
      }
      return { ...prev, [groupUuid]: [...current, optionUuid] };
    });
  }

  function handleConfirm() {
    for (const group of groups) {
      const count = (selectedByGroup[group.uuid] ?? []).length;
      if (count < group.minSelect || count > group.maxSelect) {
        setError(
          `En “${group.name}” elige entre ${group.minSelect} y ${group.maxSelect} opción(es).`,
        );
        return;
      }
    }
    const trimmed = notes.trim().slice(0, CART_ITEM_NOTES_MAX);
    onConfirm(trimmed.length > 0 ? trimmed : null, selectedModifiers);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="sheet-enter relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[1.5rem] border border-border bg-card"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Agregar al pedido
            </p>
            <h2
              id={titleId}
              className="mt-0.5 truncate text-base font-bold tracking-tight"
            >
              {product.name}
            </h2>
            <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
              {formatCurrency(unitPrice)}
              {selectedModifiers.length > 0 ? (
                <span className="text-muted-foreground/80">
                  {" "}
                  · base {product.formattedPrice}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${focusRing} inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground`}
            aria-label="Cerrar"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {groups.map((group) => {
            const selected = selectedByGroup[group.uuid] ?? [];
            const hint =
              group.minSelect === group.maxSelect
                ? `Elige ${group.minSelect}`
                : `Elige ${group.minSelect}–${group.maxSelect}`;
            return (
              <fieldset key={group.uuid} className="space-y-2">
                <legend className="text-sm font-semibold text-foreground">
                  {group.name}
                  {group.minSelect > 0 ? (
                    <span className="ml-1 text-destructive">*</span>
                  ) : null}
                </legend>
                <p className="text-xs text-muted-foreground">{hint}</p>
                <div className="grid gap-2">
                  {group.options
                    .filter((o) => o.available)
                    .map((opt) => {
                      const active = selected.includes(opt.uuid);
                      return (
                        <button
                          key={opt.uuid}
                          type="button"
                          onClick={() =>
                            toggleOption(group.uuid, opt.uuid, group.maxSelect)
                          }
                          className={`${focusRing} flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-secondary"
                          }`}
                        >
                          <span className="font-medium">{opt.name}</span>
                          <span className="shrink-0 tabular-nums opacity-90">
                            {opt.priceDelta > 0
                              ? `+${opt.formattedPriceDelta}`
                              : "Incluido"}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </fieldset>
            );
          })}

          <label htmlFor={notesId} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Notas <span className="font-normal">(opcional)</span>
            </span>
            <textarea
              id={notesId}
              name="notes"
              rows={3}
              maxLength={CART_ITEM_NOTES_MAX}
              placeholder="Ej. sin cebolla…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${fieldClass} min-h-[5.5rem] resize-none`}
            />
            <span className="text-[0.65rem] tabular-nums text-muted-foreground">
              {notes.trim().length}/{CART_ITEM_NOTES_MAX}
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-testid="product-add-confirm"
            onClick={handleConfirm}
            className={`${focusRing} flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--menu-accent)] px-4 text-sm font-semibold text-[var(--menu-accent-fg)] transition-transform active:scale-[0.98]`}
          >
            Agregar · {formatCurrency(unitPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
