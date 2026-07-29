"use client";

/**
 * Sheet al agregar un platillo: notas opcionales para cocina.
 */

import { useEffect, useId, useState } from "react";
import type { Product } from "@/types/api";
import { CART_ITEM_NOTES_MAX } from "@/store/cartStore";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

interface ProductAddSheetProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string | null) => void;
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
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onClose,
  });

  useEffect(() => {
    if (open) setNotes("");
  }, [open, product.uuid]);

  if (!open) return null;

  function handleConfirm() {
    const trimmed = notes.trim().slice(0, CART_ITEM_NOTES_MAX);
    onConfirm(trimmed.length > 0 ? trimmed : null);
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
        className="sheet-enter relative z-10 flex w-full max-w-md flex-col rounded-t-[1.5rem] border border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
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
              {product.formattedPrice}
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

        <div className="px-5 py-4">
          <label htmlFor={notesId} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Notas{" "}
              <span className="font-normal">(opcional)</span>
            </span>
            <textarea
              id={notesId}
              name="notes"
              rows={3}
              maxLength={CART_ITEM_NOTES_MAX}
              placeholder="Ej. sin cebolla, término medio…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${fieldClass} min-h-[5.5rem] resize-none`}
            />
            <span className="text-[0.65rem] tabular-nums text-muted-foreground">
              {notes.trim().length}/{CART_ITEM_NOTES_MAX}
            </span>
          </label>
        </div>

        <div className="border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleConfirm}
            className={`${focusRing} flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--menu-accent)] px-4 text-sm font-semibold text-[var(--menu-accent-fg)] transition-transform active:scale-[0.98]`}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
