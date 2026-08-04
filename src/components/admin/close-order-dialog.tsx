"use client";

/**
 * Diálogo de cobro: exige método de pago real antes de cerrar la cuenta.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import type { OrderPaymentMethod } from "@/types/api";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { ticketPrintBeforeCloseLabel } from "@/lib/ticket-from-order";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const PAYMENT_OPTIONS: Array<{ value: OrderPaymentMethod; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];

export interface CloseOrderDialogProps {
  open: boolean;
  title?: string;
  description: string;
  /** Preferencia del comensal (p. ej. aviso BILL). */
  preferredPaymentMethod?: OrderPaymentMethod | null;
  /** Bloque extra bajo el selector (raro; la impresión va por onPrint). */
  detail?: ReactNode;
  showPrintAction?: boolean;
  busy?: boolean;
  error?: string | null;
  overlayClassName?: string;
  onConfirm: (paymentMethod: OrderPaymentMethod) => void;
  onCancel: () => void;
  onPrint?: () => void;
}

export function CloseOrderDialog({
  open,
  title = "Cobrar y cerrar cuenta",
  description,
  preferredPaymentMethod = null,
  detail = null,
  showPrintAction = true,
  busy = false,
  error = null,
  overlayClassName = "z-[70]",
  onConfirm,
  onCancel,
  onPrint,
}: CloseOrderDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setPaymentMethod(null);
      return;
    }
    setPaymentMethod(preferredPaymentMethod ?? null);
  }, [open, preferredPaymentMethod]);

  const panelRef = useModalFocusTrap({
    open,
    onEscape: onCancel,
    escapeEnabled: !busy,
  });

  if (!open) return null;

  const canConfirm = paymentMethod != null && !busy;
  const describedBy = [
    "close-order-desc",
    "close-order-payment",
    detail ? "close-order-detail" : null,
    error ? "close-order-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`fixed inset-0 ${overlayClassName} flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="close-order-title"
        aria-describedby={describedBy}
        className="w-full max-w-md max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:rounded-2xl sm:pb-5"
      >
        <h2
          id="close-order-title"
          className="text-lg font-bold tracking-tight"
        >
          {title}
        </h2>
        <p
          id="close-order-desc"
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>

        <fieldset id="close-order-payment" className="mt-4 space-y-2">
          <legend className="text-sm font-semibold text-foreground">
            Método de pago
          </legend>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Método de pago"
          >
            {PAYMENT_OPTIONS.map((opt) => {
              const active = paymentMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`close-pay-${opt.value}`}
                  disabled={busy}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors ${focusRing} ${
                    active
                      ? "border-live bg-live-muted text-live-ink"
                      : "border-border bg-secondary text-foreground hover:bg-secondary/80"
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {showPrintAction && onPrint ? (
          <button
            type="button"
            onClick={onPrint}
            disabled={busy}
            className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing} disabled:opacity-50`}
          >
            <Printer className="size-4" aria-hidden />
            {ticketPrintBeforeCloseLabel()}
          </button>
        ) : null}

        {detail ? (
          <div id="close-order-detail" className="mt-3">
            {detail}
          </div>
        ) : null}

        {error ? (
          <p
            id="close-order-error"
            role="alert"
            className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="confirm-dialog-confirm"
            disabled={!canConfirm}
            onClick={() => {
              if (!paymentMethod) return;
              onConfirm(paymentMethod);
            }}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-live px-4 py-2.5 text-sm font-semibold text-live-foreground transition-colors hover:brightness-110 disabled:opacity-50 ${focusRing}`}
          >
            {busy ? "Cobrando…" : "Cobrar y cerrar cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}
