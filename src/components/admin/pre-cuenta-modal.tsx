"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
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
  resolveTicketKind,
  type RestaurantTicketInfo,
  type TicketKind,
} from "@/lib/ticket-from-order";
import { TicketReceipt } from "./ticket-receipt";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const PRINT_BODY_CLASS = "print-thermal-ticket";
const PRINT_PAGE_STYLE_ID = "thermal-print-page-style";

function clearThermalPrintArtifacts() {
  document.body.classList.remove(PRINT_BODY_CLASS);
  document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
}

export interface PreCuentaModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  restaurant: RestaurantTicketInfo;
  /** Si se omite, se deriva del status (DELIVERED/CLOSED → cuenta). */
  kind?: TicketKind;
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
}: PreCuentaModalProps) {
  if (!open || !order) return null;

  return (
    <PreCuentaModalContent
      key={`${order.uuid}-${kind ?? "auto"}`}
      order={order}
      restaurant={restaurant}
      kind={kind}
      onClose={onClose}
    />
  );
}

function PreCuentaModalContent({
  order,
  restaurant,
  kind,
  onClose,
}: {
  order: Order;
  restaurant: RestaurantTicketInfo;
  kind?: TicketKind;
  onClose: () => void;
}) {
  const [phoneInput, setPhoneInput] = useState(
    () => order.customerPhone?.trim() ?? "",
  );
  const [showWhatsappInput, setShowWhatsappInput] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const panelRef = useModalFocusTrap({
    open: true,
    onEscape: onClose,
  });

  useEffect(() => {
    window.addEventListener("afterprint", clearThermalPrintArtifacts);
    return () => {
      window.removeEventListener("afterprint", clearThermalPrintArtifacts);
      clearThermalPrintArtifacts();
    };
  }, []);

  const ticketProps = useMemo(
    () => buildTicketReceiptProps(order, restaurant, kind),
    [order, restaurant, kind],
  );

  const resolvedKind = resolveTicketKind(order, kind);
  const total = order.totalAmount;
  const titleLabel = orderTicketLabel(order);
  const folio = orderFolio(order);
  const itemCount = order.items.length;
  const kindTitle = resolvedKind === "cuenta" ? "Cuenta" : "Pre-cuenta";

  function showToast(msg: string) {
    setNotification(msg);
    window.setTimeout(() => setNotification(null), 2800);
  }

  function handlePrint() {
    clearThermalPrintArtifacts();
    document.body.classList.add(PRINT_BODY_CLASS);
    if (!document.getElementById(PRINT_PAGE_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = PRINT_PAGE_STYLE_ID;
      style.textContent =
        "@media print { @page { size: 80mm auto; margin: 0; } }";
      document.head.appendChild(style);
    }
    showToast("Abriendo diálogo de impresión…");
    window.setTimeout(() => {
      window.print();
    }, 50);
  }

  function buildWhatsappMessage(): string {
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
    if (resolvedKind === "pre-cuenta") {
      lines.push("_Pre-cuenta · no es comprobante fiscal_");
    } else {
      lines.push("¡Gracias por tu visita!");
    }
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

  const printSheet =
    typeof document !== "undefined"
      ? createPortal(
          <div className="thermal-print-sheet" aria-hidden>
            <TicketReceipt {...ticketProps} isPrintOnlyMode />
          </div>,
          document.body,
        )
      : null;

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
            {itemCount === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Esta cuenta no tiene consumos para imprimir.
              </p>
            ) : (
              <>
                <p className="mb-3 text-center text-xs text-muted-foreground">
                  Vista 80mm · lista para impresora térmica
                </p>
                <div className="flex justify-center pb-2">
                  <TicketReceipt {...ticketProps} />
                </div>
              </>
            )}
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

          <div className="flex flex-col gap-2 border-t border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
            <p className="hidden text-[11px] text-muted-foreground sm:block sm:max-w-[11rem]">
              En el diálogo del sistema también puedes guardar como PDF
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (showWhatsappInput) handleSendWhatsapp();
                  else setShowWhatsappInput(true);
                }}
                disabled={itemCount === 0}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={itemCount === 0}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                title="Imprimir o guardar como PDF desde el diálogo del sistema"
              >
                <Printer className="size-4" aria-hidden />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
