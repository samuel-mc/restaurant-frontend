"use client";

/**
 * FAB + sheet: llamar mesero / pedir cuenta desde el menú QR.
 */

import { useId, useState } from "react";
import { Bell, Receipt, X } from "lucide-react";
import {
  createTableCall,
  getTableCallErrorMessage,
} from "@/services/tableCallService";
import type { TableCallPaymentMethod, TableCallType } from "@/types/api";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { formatTableLabel } from "@/lib/table-session";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PAYMENT_OPTIONS: Array<{
  value: TableCallPaymentMethod;
  label: string;
}> = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];

interface TableHelpFabProps {
  tenantSlug: string;
  tableNumber: string;
  tableToken: string;
  /** Empuja el FAB sobre la barra del carrito. */
  elevated?: boolean;
}

export function TableHelpFab({
  tenantSlug,
  tableNumber,
  tableToken,
  elevated = false,
}: TableHelpFabProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "bill">("menu");
  const [paymentMethod, setPaymentMethod] =
    useState<TableCallPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentLabel, setSentLabel] = useState<string | null>(null);

  const panelRef = useModalFocusTrap({
    open,
    onEscape: () => {
      if (!busy) closeSheet();
    },
    escapeEnabled: !busy,
  });

  function closeSheet() {
    setOpen(false);
    setStep("menu");
    setPaymentMethod(null);
    setError(null);
  }

  function openSheet() {
    setSentLabel(null);
    setError(null);
    setStep("menu");
    setPaymentMethod(null);
    setOpen(true);
  }

  async function sendCall(
    callType: TableCallType,
    method?: TableCallPaymentMethod | null,
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await createTableCall(tenantSlug, {
        tableNumber,
        tableToken,
        callType,
        paymentMethod: callType === "BILL" ? method ?? null : null,
      });
      setSentLabel(
        callType === "BILL"
          ? "Listo · ya pedimos la cuenta"
          : "Listo · ya avisamos al mesero",
      );
      closeSheet();
      window.setTimeout(() => setSentLabel(null), 4_000);
    } catch (err) {
      setError(getTableCallErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const bottomOffset = elevated
    ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
    : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]";

  return (
    <>
      {sentLabel ? (
        <div
          role="status"
          className={`fixed left-1/2 z-40 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-live/30 bg-live-muted px-4 py-3 text-center text-sm font-semibold text-live-ink shadow-sm ${bottomOffset}`}
        >
          {sentLabel}
        </div>
      ) : null}

      <button
        type="button"
        onClick={openSheet}
        aria-label="Pedir ayuda o la cuenta"
        className={`fixed right-4 z-30 inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-bold text-background ${bottomOffset} ${focusRing}`}
      >
        <Bell className="size-5" aria-hidden />
        <span className="hidden sm:inline">Ayuda</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => !busy && closeSheet()}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {formatTableLabel(tableNumber)}
                </p>
                <h2 id={titleId} className="mt-1 text-xl font-bold tracking-tight">
                  {step === "bill" ? "Pedir la cuenta" : "¿Qué necesitas?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !busy && closeSheet()}
                className={`inline-flex size-11 items-center justify-center rounded-full bg-secondary ${focusRing}`}
                aria-label="Cerrar"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {error ? (
              <p
                role="alert"
                className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            {step === "menu" ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendCall("WAITER")}
                  className={`inline-flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 text-left ${focusRing} disabled:opacity-60`}
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-card">
                    <Bell className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-base font-bold">
                      Llamar al mesero
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Servilletas, cubiertos o ayuda
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setStep("bill");
                  }}
                  className={`inline-flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 text-left ${focusRing} disabled:opacity-60`}
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-card">
                    <Receipt className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-base font-bold">
                      Pedir la cuenta
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Avisa cómo quieres pagar
                    </span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Opcional: indica con qué pagarás para agilizar al mesero.
                </p>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Forma de pago">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const active = paymentMethod === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setPaymentMethod((prev) =>
                            prev === opt.value ? null : opt.value,
                          )
                        }
                        className={`min-h-12 rounded-xl border px-2 text-sm font-semibold ${focusRing} ${
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep("menu");
                      setError(null);
                    }}
                    className={`min-h-12 rounded-xl border border-border bg-secondary text-sm font-semibold ${focusRing}`}
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendCall("BILL", paymentMethod)}
                    className={`min-h-12 rounded-xl bg-live text-sm font-bold text-live-foreground ${focusRing} disabled:opacity-60`}
                  >
                    {busy ? "Enviando…" : "Pedir cuenta"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
