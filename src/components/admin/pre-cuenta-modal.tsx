"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  FileText,
  MessageCircle,
  PhoneCall,
  Printer,
  Receipt,
  X,
} from "lucide-react";
import type { Order } from "@/types/api";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { formatCurrency } from "@/lib/format";
import {
  buildTicketReceiptProps,
  orderFolio,
  orderTicketLabel,
  type RestaurantTicketInfo,
  type TicketKind,
} from "@/lib/ticket-from-order";
import { TicketReceipt } from "./ticket-receipt";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const PRINT_BODY_CLASS = "print-thermal-ticket";

export interface PreCuentaModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  restaurant: RestaurantTicketInfo;
  /** pre-cuenta (default) o cuenta al cobrar. */
  kind?: TicketKind;
}

/**
 * Vista previa + impresión / WhatsApp / PDF de ticket térmico 80mm.
 * La hoja imprimible vive en un portal fuera del modal (el modal usa print:hidden).
 */
export function PreCuentaModal({
  open,
  onClose,
  order,
  restaurant,
  kind = "pre-cuenta",
}: PreCuentaModalProps) {
  const [phoneInput, setPhoneInput] = useState("");
  const [showWhatsappInput, setShowWhatsappInput] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const panelRef = useModalFocusTrap({
    open: open && order != null,
    onEscape: onClose,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !order) return;
    setPhoneInput(order.customerPhone?.trim() ?? "");
    setShowWhatsappInput(false);
    setNotification(null);
  }, [open, order]);

  useEffect(() => {
    function clearPrintClass() {
      document.body.classList.remove(PRINT_BODY_CLASS);
      document.getElementById("thermal-print-page-style")?.remove();
    }
    window.addEventListener("afterprint", clearPrintClass);
    return () => {
      window.removeEventListener("afterprint", clearPrintClass);
      clearPrintClass();
    };
  }, []);

  const ticketProps = useMemo(() => {
    if (!order) return null;
    return buildTicketReceiptProps(order, restaurant, kind);
  }, [order, restaurant, kind]);

  const total = order?.totalAmount ?? 0;
  const titleLabel = order ? orderTicketLabel(order) : "";
  const folio = order ? orderFolio(order) : "";
  const itemCount = order?.items.length ?? 0;
  const kindTitle = kind === "cuenta" ? "Cuenta" : "Pre-cuenta";

  function showToast(msg: string) {
    setNotification(msg);
    window.setTimeout(() => setNotification(null), 2800);
  }

  function handlePrint() {
    document.body.classList.add(PRINT_BODY_CLASS);
    if (!document.getElementById("thermal-print-page-style")) {
      const style = document.createElement("style");
      style.id = "thermal-print-page-style";
      style.textContent =
        "@media print { @page { size: 80mm auto; margin: 0; } }";
      document.head.appendChild(style);
    }
    showToast("Abriendo diálogo de impresión…");
    // Deja pintar la hoja de print antes del diálogo del sistema.
    window.setTimeout(() => {
      window.print();
    }, 50);
  }

  function buildWhatsappMessage(): string {
    if (!order || !ticketProps) return "";
    const lines: string[] = [];
    lines.push(`*${kindTitle.toUpperCase()} — ${restaurant.name.toUpperCase()}*`);
    lines.push("--------------------------------");
    lines.push(`*Cuenta:* ${titleLabel} | *Folio:* ${folio}`);
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
    lines.push("*Sugerencia de propina:*");
    lines.push(`• 10%: ${formatCurrency(total * 0.1)}`);
    lines.push(`• 15%: ${formatCurrency(total * 0.15)}`);
    lines.push(`• 18%: ${formatCurrency(total * 0.18)}`);
    lines.push("");
    lines.push("¡Gracias por tu visita!");
    return encodeURIComponent(lines.join("\n"));
  }

  function handleSendWhatsapp() {
    const cleanPhone = phoneInput.replace(/\D/g, "");
    const encodedMsg = buildWhatsappMessage();
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    showToast("Abriendo WhatsApp…");
    setShowWhatsappInput(false);
  }

  if (!open || !order || !ticketProps) return null;

  const printSheet =
    mounted &&
    createPortal(
      <div className="thermal-print-sheet" aria-hidden>
        <TicketReceipt {...ticketProps} isPrintOnlyMode />
      </div>,
      document.body,
    );

  return (
    <>
      {printSheet}

      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 print:hidden sm:items-center sm:p-4"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {notification ? (
          <div
            className="fixed top-4 right-4 z-[90] flex items-center gap-2 rounded-xl border border-live/30 bg-live-muted px-4 py-3 text-sm font-medium text-live-ink shadow-lg"
            role="status"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            <span>{notification}</span>
          </div>
        ) : null}

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pre-cuenta-title"
          className="flex max-h-[min(92dvh,100%)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <Receipt className="size-4" aria-hidden />
                </span>
                <h2
                  id="pre-cuenta-title"
                  className="truncate text-lg font-bold tracking-tight"
                >
                  {kindTitle} · {titleLabel}
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Folio {folio} · {itemCount}{" "}
                {itemCount === 1 ? "ítem" : "ítems"} ·{" "}
                {formatCurrency(total)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary ${focusRing}`}
              aria-label="Cerrar"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-secondary/40 px-4 py-5 sm:px-6">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              Vista 80mm · lista para impresora térmica
            </p>
            <div className="flex justify-center pb-2">
              <TicketReceipt {...ticketProps} />
            </div>
          </div>

          {showWhatsappInput ? (
            <div className="flex flex-col gap-3 border-t border-border bg-secondary/60 px-5 py-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PhoneCall className="size-4 shrink-0" aria-hidden />
                <span>Tel. cliente (opcional)</span>
              </div>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="5512345678"
                className={`min-h-11 w-full flex-1 rounded-xl border border-border bg-card px-3 text-sm sm:max-w-[12rem] ${focusRing}`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSendWhatsapp}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-live px-3 text-sm font-semibold text-live-foreground sm:flex-none ${focusRing}`}
                >
                  Enviar
                </button>
                <button
                  type="button"
                  onClick={() => setShowWhatsappInput(false)}
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold ${focusRing}`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:px-5">
            <button
              type="button"
              onClick={handlePrint}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold ${focusRing}`}
              title="Guardar como PDF desde el diálogo de impresión"
            >
              <FileText className="size-4" aria-hidden />
              PDF
            </button>
            <button
              type="button"
              onClick={() => {
                if (showWhatsappInput) handleSendWhatsapp();
                else setShowWhatsappInput(true);
              }}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold ${focusRing}`}
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground ${focusRing}`}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
