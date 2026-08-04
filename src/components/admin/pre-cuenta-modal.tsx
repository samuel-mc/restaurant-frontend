"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Printer,
  X,
} from "lucide-react";
import type { Order, OrderPaymentMethod } from "@/types/api";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { formatCurrency } from "@/lib/format";
import {
  buildTicketReceiptProps,
  orderFolio,
  orderTicketLabel,
  resolveTicketKind,
  ticketKindLabel,
  ticketRecommendedTip,
  ticketTipSuggestions,
  type RestaurantTicketInfo,
  type TicketKind,
} from "@/lib/ticket-from-order";
import { TicketReceipt } from "./ticket-receipt";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const PRINT_BODY_CLASS = "print-thermal-ticket";
const PRINT_PAGE_STYLE_ID = "thermal-print-page-style";
const PRINT_BUSY_FALLBACK_MS = 15_000;
const TOAST_MS = 4_200;

type ToastTone = "live" | "warn" | "danger";

const TOAST_CHROME: Record<
  ToastTone,
  { shell: string; Icon: typeof CheckCircle2; assertive: boolean }
> = {
  live: {
    shell:
      "border-live/30 bg-live-muted text-live-ink",
    Icon: CheckCircle2,
    assertive: false,
  },
  warn: {
    shell: "border-warn/40 bg-warn-muted text-warn-ink",
    Icon: AlertTriangle,
    assertive: true,
  },
  danger: {
    shell: "border-destructive/40 bg-destructive/10 text-destructive",
    Icon: AlertCircle,
    assertive: true,
  },
};

function clearThermalPrintArtifacts() {
  document.documentElement.classList.remove(PRINT_BODY_CLASS);
  document.body.classList.remove(PRINT_BODY_CLASS);
  document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
}

function ensureThermalPrintPageStyle() {
  if (document.getElementById(PRINT_PAGE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PRINT_PAGE_STYLE_ID;
  style.textContent = [
    "@media print {",
    "  @page { size: 80mm auto; margin: 0; }",
    "  html.print-thermal-ticket, body.print-thermal-ticket {",
    "    height: auto !important; min-height: 0 !important;",
    "  }",
    "}",
  ].join("\n");
  document.head.appendChild(style);
}

/** Extrae los 10 dígitos locales MX de un teléfono guardado (52 / 521 / local). */
function mxLocalTenDigits(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("52")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("521")) return digits.slice(3);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Vacío = enviar sin número (WhatsApp pide el contacto).
 * Con dígitos: exige 10 locales MX → wa.me/52XXXXXXXXXX.
 */
function resolveMxWhatsappDigits(
  localTen: string,
): { ok: true; digits: string | null } | { ok: false; message: string } {
  const digits = localTen.replace(/\D/g, "");
  if (!digits) return { ok: true, digits: null };
  if (digits.length === 10) return { ok: true, digits: `52${digits}` };
  return {
    ok: false,
    message: "Celular MX: 10 dígitos (sin +52). Déjalo vacío para elegir el chat.",
  };
}

export interface PreCuentaModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  restaurant: RestaurantTicketInfo;
  /** Si se omite, se deriva del status (DELIVERED/CLOSED → cuenta). */
  kind?: TicketKind;
  /**
   * Si el modal se abrió desde Cobrar: al cerrar se reanuda esa acción.
   * Se muestra como pista operativa (no apilar diálogos).
   */
  returnToActionLabel?: string;
  /**
   * Cobrar desde el ticket: pide método de pago y cierra la cuenta.
   * Solo se muestra cuando la orden está DELIVERED.
   */
  onChargeAndClose?: (paymentMethod: OrderPaymentMethod) => void | Promise<void>;
}

/**
 * Vista previa + impresión / WhatsApp de ticket térmico 80mm.
 * La hoja imprimible vive en un portal fuera del modal (el modal usa print:hidden).
 */
export function PreCuentaModal({
  open,
  onClose,
  order,
  restaurant,
  kind,
  returnToActionLabel,
  onChargeAndClose,
}: PreCuentaModalProps) {
  if (!open || !order) return null;

  return (
    <PreCuentaModalContent
      key={`${order.uuid}-${kind ?? "auto"}`}
      order={order}
      restaurant={restaurant}
      kind={kind}
      onClose={onClose}
      returnToActionLabel={returnToActionLabel}
      onChargeAndClose={onChargeAndClose}
    />
  );
}

function PreCuentaModalContent({
  order,
  restaurant,
  kind,
  onClose,
  returnToActionLabel,
  onChargeAndClose,
}: {
  order: Order;
  restaurant: RestaurantTicketInfo;
  kind?: TicketKind;
  onClose: () => void;
  returnToActionLabel?: string;
  onChargeAndClose?: (paymentMethod: OrderPaymentMethod) => void | Promise<void>;
}) {
  const [phoneInput, setPhoneInput] = useState(() =>
    mxLocalTenDigits(order.customerPhone),
  );
  const [showWhatsappInput, setShowWhatsappInput] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const [chargeMethod, setChargeMethod] = useState<OrderPaymentMethod | null>(
    null,
  );
  const [chargeBusy, setChargeBusy] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const printFallbackTimerRef = useRef<number | null>(null);
  const printBusyRef = useRef(false);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const printButtonRef = useRef<HTMLButtonElement | null>(null);
  const showWhatsappRef = useRef(false);
  const wasWhatsappOpenRef = useRef(false);
  const kindNounRef = useRef("pre-cuenta");
  showWhatsappRef.current = showWhatsappInput;

  const panelRef = useModalFocusTrap({
    open: true,
    onEscape: () => {
      if (printBusyRef.current) return;
      // Escape primero cierra WhatsApp; segundo cierra el modal.
      if (showWhatsappRef.current) {
        setShowWhatsappInput(false);
        setPhoneError(null);
        return;
      }
      onClose();
    },
    initialFocusRef: order.items.length > 0 ? printButtonRef : undefined,
  });

  function showToast(msg: string, tone: ToastTone = "live") {
    setNotification({ message: msg, tone });
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setNotification(null);
      toastTimerRef.current = null;
    }, TOAST_MS);
  }

  function endPrintBusy() {
    printBusyRef.current = false;
    setPrintBusy(false);
    clearThermalPrintArtifacts();
    if (printFallbackTimerRef.current != null) {
      window.clearTimeout(printFallbackTimerRef.current);
      printFallbackTimerRef.current = null;
    }
  }

  useEffect(() => {
    function onAfterPrint() {
      if (!printBusyRef.current) {
        clearThermalPrintArtifacts();
        return;
      }
      endPrintBusy();
      // Ámbar: el SO no confirma si salió papel; el mesero debe verificar.
      showToast(
        `Diálogo cerrado — revisa si salió la ${kindNounRef.current}. Si no, vuelve a Imprimir · térmica 80mm`,
        "warn",
      );
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      if (printFallbackTimerRef.current != null) {
        window.clearTimeout(printFallbackTimerRef.current);
      }
      printBusyRef.current = false;
      clearThermalPrintArtifacts();
    };
    // Mount-only print lifecycle; toast uses stable setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- print listeners
  }, []);

  useEffect(() => {
    if (showWhatsappInput) {
      wasWhatsappOpenRef.current = true;
      const id = window.requestAnimationFrame(() => {
        phoneInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
    if (wasWhatsappOpenRef.current) {
      wasWhatsappOpenRef.current = false;
      const id = window.requestAnimationFrame(() => {
        printButtonRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [showWhatsappInput]);

  const ticketProps = useMemo(
    () => buildTicketReceiptProps(order, restaurant, kind),
    [order, restaurant, kind],
  );

  const resolvedKind = resolveTicketKind(order, kind);
  const total = order.totalAmount;
  const titleLabel = orderTicketLabel(order);
  const folio = orderFolio(order);
  const itemCount = order.items.length;
  const kindTitle = ticketKindLabel(resolvedKind);
  const kindNoun = resolvedKind === "cuenta" ? "cuenta" : "pre-cuenta";
  kindNounRef.current = kindNoun;
  const itemLabel =
    itemCount === 1 ? "1 consumo" : `${itemCount} consumos`;
  // Meta ≤3 hechos; fiscal vive en el papel; resume tiene banner propio.
  const metaParts = [`Folio ${folio}`, itemLabel, formatCurrency(total)];
  const resumeHint = returnToActionLabel
    ? `Al cerrar vuelves a ${returnToActionLabel}`
    : null;

  function handleClose() {
    if (printBusyRef.current) return;
    onClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (printBusyRef.current) return;

    const target = event.target as HTMLElement;

    if (showWhatsappInput) {
      // Enter en el teléfono → Enviar (no Imprimir).
      if (
        target === phoneInputRef.current ||
        phoneInputRef.current?.contains(target)
      ) {
        event.preventDefault();
        handleSendWhatsapp();
      }
      return;
    }

    if (itemCount === 0) return;
    const focusedButton = target.closest("button");
    // Otro botón (WhatsApp / Cerrar) conserva su Enter nativo.
    if (focusedButton && focusedButton !== printButtonRef.current) return;
    if (focusedButton === printButtonRef.current) return; // click nativo
    event.preventDefault();
    handlePrint();
  }

  function handlePrint() {
    if (printBusyRef.current || itemCount === 0) return;
    clearThermalPrintArtifacts();
    document.documentElement.classList.add(PRINT_BODY_CLASS);
    document.body.classList.add(PRINT_BODY_CLASS);
    // Override del @page letter (QR admin) para no forzar hojas Carta vacías.
    ensureThermalPrintPageStyle();
    printBusyRef.current = true;
    setPrintBusy(true);
    // Guía pegada en el footer mientras busy; toast solo para afterprint / fallos.
    if (printFallbackTimerRef.current != null) {
      window.clearTimeout(printFallbackTimerRef.current);
    }
    printFallbackTimerRef.current = window.setTimeout(() => {
      // Algunos entornos no disparan afterprint si el diálogo nunca abrió.
      if (!printBusyRef.current) return;
      endPrintBusy();
      showToast(
        "No se abrió el diálogo de impresión. Revisa permisos del navegador e inténtalo de nuevo",
        "danger",
      );
    }, PRINT_BUSY_FALLBACK_MS);
    window.setTimeout(() => {
      try {
        window.print();
      } catch {
        endPrintBusy();
        showToast(
          "No se pudo abrir la impresión. Revisa la impresora e inténtalo de nuevo",
          "danger",
        );
      }
    }, 50);
  }

  function buildWhatsappMessage(): string {
    const lines: string[] = [];
    lines.push(`*${kindTitle.toUpperCase()} — ${restaurant.name.toUpperCase()}*`);
    lines.push("--------------------------------");
    lines.push(`*${titleLabel}* · Folio ${folio}`);
    if (ticketProps.waiterName) {
      lines.push(`*Mesero:* ${ticketProps.waiterName}`);
    }
    lines.push(`*Fecha:* ${ticketProps.dateTime ?? ""}`);
    lines.push("");
    lines.push("*Detalle:*");
    for (const item of ticketProps.items ?? []) {
      lines.push(
        `• ${item.quantity}x ${item.name} — ${formatCurrency(item.price)}`,
      );
      for (const m of item.modifiers ?? []) {
        lines.push(
          `   └ + ${m.name}${m.priceDelta ? ` (+${formatCurrency(m.priceDelta)})` : ""}`,
        );
      }
      if (item.notes) lines.push(`   Obs: ${item.notes}`);
    }
    lines.push("--------------------------------");
    lines.push(`*TOTAL: ${formatCurrency(total)}*`);
    lines.push("");
    const recommended = ticketRecommendedTip(total);
    lines.push(
      `*Propina sugerida (${recommended.label}):* ${formatCurrency(recommended.amount)}`,
    );
    lines.push(
      `*Total con propina:* ${formatCurrency(recommended.withTip)}`,
    );
    const otherTips = ticketTipSuggestions(total).filter(
      (tip) => tip.label !== recommended.label,
    );
    if (otherTips.length > 0) {
      lines.push(
        `_Otras:_ ${otherTips
          .map((tip) => `${tip.label} ${formatCurrency(tip.amount)}`)
          .join(" · ")}`,
      );
    }
    lines.push("");
    if (resolvedKind === "pre-cuenta") {
      lines.push("_Pre-cuenta · no es comprobante fiscal_");
    } else {
      lines.push("¡Gracias por tu visita!");
    }
    return encodeURIComponent(lines.join("\n"));
  }

  function handleSendWhatsapp() {
    const resolved = resolveMxWhatsappDigits(phoneInput);
    if (!resolved.ok) {
      setPhoneError(resolved.message);
      return;
    }
    setPhoneError(null);
    const encodedMsg = buildWhatsappMessage();
    const whatsappUrl = resolved.digits
      ? `https://wa.me/${resolved.digits}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    showToast(
      resolved.digits
        ? "Abriendo WhatsApp…"
        : "Abriendo WhatsApp — elige el contacto…",
      "live",
    );
    setShowWhatsappInput(false);
  }

  function collapseWhatsapp() {
    setShowWhatsappInput(false);
    setPhoneError(null);
  }

  const printSheet =
    typeof document !== "undefined"
      ? createPortal(
          <div className="thermal-print-sheet" aria-hidden>
            <TicketReceipt {...ticketProps} isPrintOnlyMode />
          </div>,
          document.body,
        )
      : null;

  const toastChrome = notification ? TOAST_CHROME[notification.tone] : null;
  const ToastIcon = toastChrome?.Icon;

  return (
    <>
      {printSheet}

      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 print:hidden sm:items-center sm:p-4"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        {notification && toastChrome && ToastIcon ? (
          <div
            className={`fixed top-4 right-4 z-[90] flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${toastChrome.shell}`}
            role={toastChrome.assertive ? "alert" : "status"}
            aria-live={toastChrome.assertive ? "assertive" : "polite"}
          >
            <ToastIcon className="size-4 shrink-0" aria-hidden />
            <span>{notification.message}</span>
          </div>
        ) : null}

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pre-cuenta-title"
          aria-busy={printBusy || undefined}
          data-testid="pre-cuenta-modal"
          onKeyDown={handleDialogKeyDown}
          className="flex max-h-[min(92dvh,100%)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
        >
          <div className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                      resolvedKind === "cuenta"
                        ? "bg-live-muted text-live-ink"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {kindTitle}
                  </span>
                  <h2
                    id="pre-cuenta-title"
                    className="truncate text-lg font-bold tracking-tight"
                  >
                    {titleLabel}
                  </h2>
                </div>
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  {metaParts.join(" · ")}
                </p>
                {resumeHint ? (
                  <p className="mt-2 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground">
                    {resumeHint}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={printBusy}
                className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                aria-label="Cerrar"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-secondary/40 px-4 py-5 sm:px-6">
            {itemCount === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Esta {kindNoun} no tiene consumos para imprimir.
              </p>
            ) : (
              <>
                <p className="mb-3 text-center text-xs text-muted-foreground">
                  Así sale en térmica · 80mm
                </p>
                <div className="flex justify-center pb-2">
                  <TicketReceipt {...ticketProps} />
                </div>
              </>
            )}
          </div>

          {printBusy ? (
            <div
              className="shrink-0 border-t border-border bg-secondary px-4 py-2.5 text-center text-xs font-semibold text-foreground sm:px-5"
              role="status"
              aria-live="polite"
            >
              Elige térmica 80mm (no Carta)… cierra el diálogo al terminar
            </div>
          ) : null}

          {showWhatsappInput ? (
            <div className="border-t border-border bg-secondary/60 px-4 py-4 sm:px-5">
              <label
                htmlFor="pre-cuenta-wa-phone"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden />
                Enviar por WhatsApp
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Celular MX opcional. Vacío = eliges el chat en WhatsApp.
              </p>
              <div className="mt-3 flex items-stretch gap-2">
                <span className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-semibold tabular-nums text-muted-foreground">
                  +52
                </span>
                <input
                  ref={phoneInputRef}
                  id="pre-cuenta-wa-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10));
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="5512345678"
                  disabled={printBusy}
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby={
                    phoneError ? "pre-cuenta-wa-phone-error" : undefined
                  }
                  className={`min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm tabular-nums disabled:opacity-50 ${focusRing}`}
                />
              </div>
              {phoneError ? (
                <p
                  id="pre-cuenta-wa-phone-error"
                  className="mt-2 text-xs font-medium text-destructive"
                  role="alert"
                >
                  {phoneError}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={collapseWhatsapp}
                  disabled={printBusy}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsapp}
                  disabled={printBusy}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Enviar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs text-muted-foreground sm:max-w-[16rem]">
                Enter imprime · térmica 80mm · PDF en el diálogo
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneError(null);
                    setShowWhatsappInput(true);
                  }}
                  disabled={itemCount === 0 || printBusy || chargeBusy}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </button>
                <button
                  ref={printButtonRef}
                  type="button"
                  data-testid="pre-cuenta-print"
                  onClick={handlePrint}
                  disabled={itemCount === 0 || printBusy || chargeBusy}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                  title="Enter · impresora térmica 80mm o PDF"
                  aria-keyshortcuts="Enter"
                >
                  <Printer className="size-4" aria-hidden />
                  {printBusy ? "Imprimiendo…" : "Imprimir"}
                </button>
              </div>
            </div>
          )}

          {onChargeAndClose && order.status === "DELIVERED" ? (
            <div className="space-y-3 border-t border-border px-4 py-4 sm:px-5">
              <p className="text-sm font-semibold text-foreground">
                Cobrar y cerrar cuenta
              </p>
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Método de pago"
              >
                {(
                  [
                    ["CASH", "Efectivo"],
                    ["CARD", "Tarjeta"],
                    ["TRANSFER", "Transferencia"],
                  ] as const
                ).map(([value, label]) => {
                  const active = chargeMethod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`pre-cuenta-pay-${value}`}
                      disabled={printBusy || chargeBusy}
                      onClick={() => {
                        setChargeMethod(value);
                        setChargeError(null);
                      }}
                      className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors ${focusRing} ${
                        active
                          ? "border-live bg-live-muted text-live-ink"
                          : "border-border bg-secondary text-foreground hover:bg-secondary/80"
                      } disabled:opacity-50`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {chargeError ? (
                <p className="text-sm text-destructive" role="alert">
                  {chargeError}
                </p>
              ) : null}
              <button
                type="button"
                data-testid="pre-cuenta-charge-close"
                disabled={!chargeMethod || printBusy || chargeBusy}
                onClick={() => {
                  if (!chargeMethod || !onChargeAndClose) return;
                  setChargeBusy(true);
                  setChargeError(null);
                  void Promise.resolve(onChargeAndClose(chargeMethod))
                    .catch((err) => {
                      setChargeError(
                        err instanceof Error
                          ? err.message
                          : "No se pudo cobrar la cuenta.",
                      );
                    })
                    .finally(() => setChargeBusy(false));
                }}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-live px-4 text-sm font-semibold text-live-foreground hover:brightness-110 disabled:opacity-50 ${focusRing}`}
              >
                {chargeBusy ? "Cobrando…" : "Cobrar y cerrar cuenta"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
