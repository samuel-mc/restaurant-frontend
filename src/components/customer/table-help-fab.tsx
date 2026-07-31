"use client";

/**
 * FAB + sheet: llamar mesero / pedir cuenta desde el menú QR.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Bell, Receipt } from "lucide-react";
import {
  createTableCall,
  getTableCallErrorMessage,
} from "@/services/tableCallService";
import type { TableCallPaymentMethod, TableCallType } from "@/types/api";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { formatTableLabel } from "@/lib/table-session";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const touchPress =
  "touch-manipulation transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

/** Ticket en pantalla (~1½ min). Auto-hide ≠ atención del personal. */
const ACTIVE_CALL_MS = 90_000;
const ACTIVE_CALL_HINT = "Solo en tu pantalla · ~1½ min · o ×";

const PAYMENT_OPTIONS: Array<{
  value: TableCallPaymentMethod;
  label: string;
  shortLabel: string;
}> = [
  { value: "CASH", label: "Efectivo", shortLabel: "Efectivo" },
  { value: "CARD", label: "Tarjeta", shortLabel: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia", shortLabel: "Transfer." },
];

type SheetStep = "menu" | "waiter-confirm" | "bill" | "recall-confirm";

type PendingCall = {
  callType: TableCallType;
  paymentMethod: TableCallPaymentMethod | null;
};

type ActiveCall = {
  callType: TableCallType;
  /** Preferencia de pago si fue cuenta (para reenvío 1-tap). */
  paymentMethod: TableCallPaymentMethod | null;
  label: string;
  /** Anuncio corto para lectores de pantalla (sin flash visual). */
  announce: string;
};

/** Última intención enviada — sobrevive al auto-hide del ticket. */
type LastIntent = {
  callType: TableCallType;
  paymentMethod: TableCallPaymentMethod | null;
};

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
  const recallTitleId = useId();
  const recallDescId = useId();
  const waiterTitleId = useId();
  const waiterDescId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const confirmActionRef = useRef<HTMLButtonElement>(null);
  const activeTimerRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SheetStep>("menu");
  const [paymentMethod, setPaymentMethod] =
    useState<TableCallPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<TableCallType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [lastIntent, setLastIntent] = useState<LastIntent | null>(null);
  /** Tras “¿Avisar otra vez?” en esta apertura de sheet. */
  const [recallUnlocked, setRecallUnlocked] = useState(false);

  useEffect(() => {
    return () => {
      if (activeTimerRef.current != null) {
        window.clearTimeout(activeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (busy) return;
    if (step !== "waiter-confirm" && step !== "recall-confirm") return;
    const id = window.requestAnimationFrame(() => {
      confirmActionRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [step, busy]);

  const panelRef = useModalFocusTrap({
    open,
    initialFocusRef: titleRef,
    onEscape: () => {
      if (busy) return;
      if (step === "recall-confirm") {
        closeSheet();
        return;
      }
      if (step === "waiter-confirm") {
        setStep(activeCall && !recallUnlocked ? "recall-confirm" : "menu");
        setError(null);
        return;
      }
      if (step === "bill") {
        setStep(activeCall && !recallUnlocked ? "recall-confirm" : "menu");
        setPaymentMethod(null);
        setError(null);
        setPendingRetry(null);
        return;
      }
      closeSheet();
    },
    escapeEnabled: !busy,
  });

  function clearActiveTimer() {
    if (activeTimerRef.current != null) {
      window.clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }
  }

  function dismissActiveCall() {
    clearActiveTimer();
    setActiveCall(null);
    // Sin ticket activo ya no hace falta el soft-block.
    if (open && step === "recall-confirm") {
      setRecallUnlocked(true);
      setStep("menu");
    }
  }

  function closeSheet() {
    setOpen(false);
    setStep("menu");
    setPaymentMethod(null);
    setError(null);
    setBusyKind(null);
    setPendingRetry(null);
    setRecallUnlocked(false);
  }

  function openSheet() {
    setError(null);
    setPendingRetry(null);
    setPaymentMethod(null);
    setBusyKind(null);
    setRecallUnlocked(false);
    setStep(activeCall ? "recall-confirm" : "menu");
    setOpen(true);
  }

  function celebrateSent(
    callType: TableCallType,
    paymentMethod: TableCallPaymentMethod | null,
  ) {
    const mesa = formatTableLabel(tableNumber);
    const ticket: ActiveCall = {
      callType,
      paymentMethod,
      label:
        callType === "BILL"
          ? `Cuenta pedida · ${mesa}`
          : `Aviso enviado · ${mesa}`,
      announce:
        callType === "BILL"
          ? "Listo. Pedimos la cuenta. El aviso en tu pantalla se oculta solo; no confirma que ya te atendieron."
          : "Listo. Avisamos al mesero. El aviso en tu pantalla se oculta solo; no confirma que ya te atendieron.",
    };

    clearActiveTimer();
    setLastIntent({ callType, paymentMethod });
    setActiveCall(ticket);

    activeTimerRef.current = window.setTimeout(() => {
      setActiveCall(null);
      activeTimerRef.current = null;
    }, ACTIVE_CALL_MS);
  }

  async function sendCall(
    callType: TableCallType,
    method?: TableCallPaymentMethod | null,
    options?: { unlocked?: boolean },
  ) {
    if (busy) return;
    // Soft-block: no reenvío mientras hay aviso activo sin desbloquear.
    if (activeCall && !recallUnlocked && !options?.unlocked) {
      setStep("recall-confirm");
      setError(null);
      return;
    }
    const payment = callType === "BILL" ? method ?? null : null;
    setBusy(true);
    setBusyKind(callType);
    setError(null);
    try {
      await createTableCall(tenantSlug, {
        tableNumber,
        tableToken,
        callType,
        paymentMethod: payment,
      });
      celebrateSent(callType, payment);
      setPendingRetry(null);
      closeSheet();
    } catch (err) {
      setPendingRetry({ callType, paymentMethod: payment });
      setError(getTableCallErrorMessage(err));
      if (callType === "WAITER") setStep("waiter-confirm");
      if (callType === "BILL") {
        setPaymentMethod(payment);
        setStep("bill");
      }
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  /** Soft-block confirmado → reenvía la misma intención (sin menú chooser). */
  function resendLastIntent() {
    const intent = activeCall
      ? {
          callType: activeCall.callType,
          paymentMethod: activeCall.paymentMethod,
        }
      : lastIntent;
    setRecallUnlocked(true);
    setError(null);
    setPendingRetry(null);
    if (!intent) {
      setStep("menu");
      return;
    }
    if (intent.callType === "BILL") {
      setPaymentMethod(intent.paymentMethod);
    }
    void sendCall(intent.callType, intent.paymentMethod, { unlocked: true });
  }

  function retryLastCall() {
    if (!pendingRetry || busy) return;
    void sendCall(pendingRetry.callType, pendingRetry.paymentMethod);
  }

  /** Ancla única de la columna derecha (ticket + FAB) sobre el carrito o el safe area. */
  const dockBottom = elevated
    ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
    : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]";

  const waiterBusy = busy && busyKind === "WAITER";
  const billBusy = busy && busyKind === "BILL";
  const recallBusy = busy && step === "recall-confirm";
  const tableLabel = formatTableLabel(tableNumber);
  const ActiveIcon = activeCall?.callType === "BILL" ? Receipt : Bell;
  const recallIntent = activeCall ?? lastIntent;
  const recallIsBill = recallIntent?.callType === "BILL";
  const fabCompact = Boolean(activeCall);

  const sheetTitle =
    step === "bill"
      ? "Pedir la cuenta"
      : step === "waiter-confirm"
        ? "Confirmar llamada"
        : step === "recall-confirm"
          ? recallIsBill
            ? "Cuenta en camino"
            : "Aviso en camino"
          : "Llamar o pedir la cuenta";

  return (
    <>
      {/* Columna derecha: ticket (lead) + FAB (soporte; compacto si hay ticket). */}
      <div
        aria-hidden={open || undefined}
        className={`fixed right-4 z-30 flex flex-col items-end gap-2 ${dockBottom} ${
          open ? "invisible" : ""
        }`}
      >
        {activeCall ? (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex w-[min(14.5rem,calc(100vw-5.5rem))] items-center gap-2 rounded-2xl border border-live/25 bg-live-muted/90 py-2 pl-2.5 pr-1 text-live-ink shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
          >
            <span className="sr-only">{activeCall.announce}</span>
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-card/80 text-live-ink ring-1 ring-live/25">
              <ActiveIcon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1" aria-hidden>
              <p className="truncate text-sm font-semibold leading-tight">
                {activeCall.label}
              </p>
              <p className="truncate text-xs font-medium leading-snug text-live-ink/75">
                {ACTIVE_CALL_HINT}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissActiveCall}
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-live-ink/80 hover:bg-live/10 hover:text-live-ink ${focusRing}`}
              aria-label="Ocultar aviso de la pantalla (no cancela el aviso al personal)"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={openSheet}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            fabCompact
              ? "Ayuda · aviso enviado en pantalla"
              : "Ayuda · llamar mesero o pedir la cuenta"
          }
          className={
            fabCompact
              ? `inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-warn/45 bg-warn-muted text-warn-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${touchPress} ${focusRing}`
              : `inline-flex min-h-14 max-w-[min(12rem,calc(100%-2rem))] items-center justify-center gap-2 rounded-full bg-warn px-4 text-sm font-bold text-warn-foreground shadow-[0_6px_16px_color-mix(in_srgb,var(--warn)_22%,transparent)] ${touchPress} ${focusRing}`
          }
        >
          <Bell
            className={fabCompact ? "size-4 shrink-0" : "size-5 shrink-0"}
            aria-hidden
          />
          {fabCompact ? null : (
            <span aria-hidden className="truncate">
              Ayuda
            </span>
          )}
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={busy || undefined}
          className="fixed inset-0 z-50 flex items-end justify-center"
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45 disabled:cursor-wait"
            disabled={busy}
            onClick={() => !busy && closeSheet()}
          />
          <div
            ref={panelRef}
            className="sheet-enter relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[1.5rem] border border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
          >
            <div
              aria-hidden
              className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[var(--menu-accent)]/40"
            />

            <div className="flex shrink-0 items-start justify-between gap-3 border-t border-[var(--menu-accent-muted)] px-5 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {tableLabel}
                </p>
                <h2
                  id={titleId}
                  ref={titleRef}
                  tabIndex={-1}
                  className="mt-0.5 text-lg font-bold tracking-tight outline-none [overflow-wrap:anywhere]"
                >
                  {sheetTitle}
                </h2>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => !busy && closeSheet()}
                className={`-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-60 ${touchPress} ${focusRing}`}
                aria-label="Cerrar"
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1">
              {error ? (
                <div
                  role="alert"
                  className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2"
                >
                  <p className="text-sm text-destructive [overflow-wrap:anywhere]">
                    {error}
                  </p>
                  {pendingRetry ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={retryLastCall}
                      aria-busy={busy || undefined}
                      className={`inline-flex min-h-11 items-center rounded-lg bg-destructive px-3 text-xs font-bold text-white disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      {busy ? "Reintentando…" : "Reintentar"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {step === "recall-confirm" ? (
                <div
                  role="group"
                  aria-labelledby={recallTitleId}
                  aria-describedby={recallDescId}
                  className="space-y-4 rounded-2xl border border-live/35 bg-live-muted p-4 text-live-ink"
                >
                  <div className="min-w-0">
                    <p
                      id={recallTitleId}
                      className="text-base font-bold [overflow-wrap:anywhere]"
                    >
                      {recallIsBill
                        ? "¿Pedir la cuenta otra vez?"
                        : "¿Avisar otra vez?"}
                    </p>
                    <p
                      id={recallDescId}
                      className="mt-1 text-sm text-live-ink/85 [overflow-wrap:anywhere]"
                    >
                      {activeCall
                        ? "Este aviso ya salió. Esperar no cancela nada; reenvía solo si aún no te atienden."
                        : "El aviso ya no está en tu pantalla, pero el personal puede seguir teniéndolo. Reenvía solo si aún no te atienden."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => closeSheet()}
                      className={`min-h-12 rounded-xl border border-live/35 bg-card text-sm font-semibold text-live-ink disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      Esperar
                    </button>
                    <button
                      ref={confirmActionRef}
                      type="button"
                      disabled={busy}
                      aria-busy={recallBusy || undefined}
                      onClick={resendLastIntent}
                      className={`min-h-12 rounded-xl bg-warn px-2 text-sm font-bold text-warn-foreground disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      {recallBusy
                        ? recallIsBill
                          ? "Pidiendo…"
                          : "Avisando…"
                        : recallIsBill
                          ? "Pedir otra vez"
                          : "Avisar otra vez"}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === "menu" ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setPendingRetry(null);
                      setStep("waiter-confirm");
                    }}
                    className={`inline-flex min-h-14 items-center gap-3 rounded-2xl border border-warn/40 bg-warn-muted px-4 text-left text-warn-ink disabled:opacity-60 ${touchPress} ${focusRing}`}
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-warn-ink ring-1 ring-warn/35">
                      <Bell className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold">
                        Llamar al mesero
                      </span>
                      <span className="block text-sm text-warn-ink/80">
                        Servilletas, cubiertos o ayuda en la mesa
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setPendingRetry(null);
                      setStep("bill");
                    }}
                    className={`inline-flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 text-left disabled:opacity-60 ${touchPress} ${focusRing}`}
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border">
                      <Receipt className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold">
                        Pedir la cuenta
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        Te traen la cuenta a la mesa
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}

              {step === "waiter-confirm" ? (
                <div
                  role="group"
                  aria-labelledby={waiterTitleId}
                  aria-describedby={waiterDescId}
                  className="space-y-4 rounded-2xl border border-warn/40 bg-warn-muted p-4 text-warn-ink"
                >
                  <div className="min-w-0">
                    <p
                      id={waiterTitleId}
                      className="text-base font-bold [overflow-wrap:anywhere]"
                    >
                      ¿Avisamos al mesero de {tableLabel}?
                    </p>
                    <p
                      id={waiterDescId}
                      className="mt-1 text-sm text-warn-ink/80"
                    >
                      Se envía un aviso al personal. Úsalo si necesitas ayuda en
                      la mesa.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setStep("menu");
                        setError(null);
                        setPendingRetry(null);
                      }}
                      className={`min-h-12 rounded-xl border border-warn/40 bg-card text-sm font-semibold text-warn-ink disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      Cancelar
                    </button>
                    <button
                      ref={confirmActionRef}
                      type="button"
                      disabled={busy}
                      aria-busy={waiterBusy || undefined}
                      onClick={() => void sendCall("WAITER")}
                      className={`min-h-12 rounded-xl bg-warn px-2 text-sm font-bold text-warn-foreground disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      {waiterBusy ? "Avisando…" : "Sí, avisar"}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === "bill" ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Elige cómo pagar para agilizar al mesero, o pide la cuenta
                    sin preferencia.
                  </p>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="group"
                    aria-label="Forma de pago (opcional)"
                  >
                    {PAYMENT_OPTIONS.map((opt) => {
                      const active = paymentMethod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={busy}
                          aria-pressed={active}
                          aria-label={opt.label}
                          title={opt.label}
                          onClick={() =>
                            setPaymentMethod((prev) =>
                              prev === opt.value ? null : opt.value,
                            )
                          }
                          className={`min-h-12 min-w-0 rounded-xl border px-1 text-xs font-semibold leading-tight sm:text-sm disabled:opacity-60 ${touchPress} ${focusRing} ${
                            active
                              ? "border-warn bg-warn text-warn-foreground"
                              : "border-border bg-secondary"
                          }`}
                        >
                          <span className="line-clamp-2 [overflow-wrap:anywhere]">
                            <span className="sm:hidden">{opt.shortLabel}</span>
                            <span className="hidden sm:inline">{opt.label}</span>
                          </span>
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
                        setPendingRetry(null);
                      }}
                      className={`min-h-12 rounded-xl border border-border bg-secondary text-sm font-semibold disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-busy={billBusy || undefined}
                      onClick={() => void sendCall("BILL", paymentMethod)}
                      className={`min-h-12 rounded-xl bg-warn px-2 text-sm font-bold text-warn-foreground disabled:opacity-60 ${touchPress} ${focusRing}`}
                    >
                      {billBusy ? "Pidiendo la cuenta…" : "Pedir la cuenta"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
