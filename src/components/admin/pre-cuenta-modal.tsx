"use client";

import React, { useState } from "react";
import {
  X,
  Printer,
  MessageCircle,
  FileText,
  CheckCircle2,
  Share2,
  PhoneCall,
  Sparkles,
  Receipt,
} from "lucide-react";
import { TicketReceipt, TicketItem } from "./ticket-receipt";

export interface PreCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber?: string;
  orderFolio?: string;
  restaurantName?: string;
  rfc?: string;
  address?: string;
  phone?: string;
  waiterName?: string;
  items?: TicketItem[];
  customerPhone?: string;
}

const DEFAULT_ITEMS: TicketItem[] = [
  {
    id: "1",
    quantity: 2,
    name: "Pizza Margherita",
    price: 360.0,
    modifiers: [
      { name: "Extra Queso", priceDelta: 20.0 },
      { name: "Masa Delgada" },
    ],
  },
  {
    id: "2",
    quantity: 1,
    name: "Pasta Carbonara",
    price: 180.0,
    notes: "Sin pimienta negra",
  },
  {
    id: "3",
    quantity: 2,
    name: "Copa Vino Red Blend",
    price: 220.0,
  },
  {
    id: "4",
    quantity: 1,
    name: "Tiramisú Tradicional",
    price: 120.0,
  },
];

export function PreCuentaModal({
  isOpen,
  onClose,
  tableNumber = "Mesa 4",
  orderFolio = "#1084",
  restaurantName = "La Trattoria",
  rfc = "TRA980415-HK2",
  address = "Av. Revolución 1234, Col. Condesa, CDMX",
  phone = "(55) 8765-4321",
  waiterName = "Carlos M.",
  items = DEFAULT_ITEMS,
  customerPhone = "5512345678",
}: PreCuentaModalProps) {
  const [phoneInput, setPhoneInput] = useState(customerPhone);
  const [showWhatsappInput, setShowWhatsappInput] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  // Total calculation for WhatsApp template
  const subtotal = items.reduce((acc, item) => {
    const modTotal =
      item.modifiers?.reduce((mAcc, m) => mAcc + (m.priceDelta || 0), 0) || 0;
    return acc + (item.price + modTotal * item.quantity);
  }, 0);

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amt);

  // 1. PRINT ACTION
  const handlePrint = () => {
    showToast("Enviando orden a la impresora térmica...");
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // 2. WHATSAPP TEMPLATE & ACTION
  const buildWhatsappMessage = () => {
    let msg = `🧾 *PRE-CUENTA - ${restaurantName.toUpperCase()}*\n`;
    msg += `--------------------------------\n`;
    msg += `📍 *Mesa:* ${tableNumber} | *Folio:* ${orderFolio}\n`;
    msg += `👤 *Mesero:* ${waiterName}\n`;
    msg += `📅 *Fecha:* ${new Date().toLocaleDateString("es-MX")} ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}\n\n`;
    msg += `*DETALLE DE CONSUMO:*\n`;

    items.forEach((item) => {
      msg += `• ${item.quantity}x ${item.name} - ${formatCurrency(item.price)}\n`;
      if (item.modifiers && item.modifiers.length > 0) {
        item.modifiers.forEach((m) => {
          msg += `   └ + ${m.name}${m.priceDelta ? ` (+${formatCurrency(m.priceDelta)})` : ""}\n`;
        });
      }
    });

    msg += `\n--------------------------------\n`;
    msg += `💰 *TOTAL A PAGAR:* *${formatCurrency(subtotal)}*\n\n`;
    msg += `💡 *Sugerencia de propina:*\n`;
    msg += `• 10%: ${formatCurrency(subtotal * 0.1)}\n`;
    msg += `• 15%: ${formatCurrency(subtotal * 0.15)}\n`;
    msg += `• 18%: ${formatCurrency(subtotal * 0.18)}\n\n`;
    msg += `¡Gracias por tu visita! Escanea nuestro QR para tu opinión.`;

    return encodeURIComponent(msg);
  };

  const handleSendWhatsapp = () => {
    const cleanPhone = phoneInput.replace(/\D/g, "");
    const encodedMsg = buildWhatsappMessage();
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;

    window.open(whatsappUrl, "_blank");
    showToast("Abriendo WhatsApp con la pre-cuenta...");
    setShowWhatsappInput(false);
  };

  // 3. PDF DOWNLOAD ACTION
  const handleDownloadPDF = () => {
    showToast("Generando PDF de la pre-cuenta...");
    // Trigger standard browser print with print-to-PDF intent fallback
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  return (
    <>
      {/* GLOBAL @MEDIA PRINT RULES SPECIFICALLY FOR THE TICKET */}
      <style jsx global>{`
        @media print {
          /* Hide all UI elements, overlays, modals, and Antigravity shells */
          body * {
            visibility: hidden !important;
          }

          /* Show ONLY the printable thermal ticket */
          #thermal-receipt-printable,
          #thermal-receipt-printable * {
            visibility: visible !important;
          }

          #thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          @page {
            size: 80mm auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* MODAL BACKDROP (Hidden during print) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md transition-all duration-300 overflow-y-auto no-print">
        {/* TOAST NOTIFICATION */}
        {notification && (
          <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-400/40 text-sm font-medium animate-bounce">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* MODAL CONTAINER */}
        <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          
          {/* HEADER BAR */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700/60">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Pre-Cuenta — {tableNumber}
                  </h2>
                  {/* Status Indicator Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Cuenta Pedida
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Orden {orderFolio} • {items.length} ítems consumidos
                </p>
              </div>
            </div>

            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-700"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* MAIN CONTENT / PREVIEW AREA */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 flex flex-col items-center justify-center min-h-[380px] custom-scrollbar">
            
            {/* HELPER HINT */}
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Simulación real de papel térmico de 80mm</span>
            </div>

            {/* THE THERMAL TICKET RECEIPT */}
            <div className="my-2 transition-transform hover:scale-[1.01] duration-200">
              <TicketReceipt
                restaurantName={restaurantName}
                rfc={rfc}
                address={address}
                phone={phone}
                tableNumber={tableNumber}
                folio={orderFolio}
                waiterName={waiterName}
                items={items}
                subtotal={subtotal}
                total={subtotal}
              />
            </div>
          </div>

          {/* WHATSAPP POPUP PROMPT */}
          {showWhatsappInput && (
            <div className="px-6 py-3 bg-slate-800/90 border-t border-slate-700 flex flex-col sm:flex-row items-center gap-3 animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2 text-xs text-slate-300 w-full sm:w-auto">
                <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Teléfono cliente (opcional):</span>
              </div>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="Ej. 5512345678"
                className="w-full sm:w-48 bg-slate-900 border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSendWhatsapp}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Enviar Chat
                </button>
                <button
                  type="button"
                  onClick={() => setShowWhatsappInput(false)}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-white text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ACTION BAR (BOTTOM FLOTANTE) */}
          <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            
            <div className="text-xs text-slate-400 hidden sm:block">
              <span>Formato listo para impresión directa</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              {/* 3. DOWNLOAD PDF BUTTON */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex-1 sm:flex-none border border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                title="Exportar a PDF"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Descargar PDF</span>
              </button>

              {/* 2. WHATSAPP BUTTON */}
              <button
                type="button"
                onClick={() => {
                  if (showWhatsappInput) {
                    handleSendWhatsapp();
                  } else {
                    setShowWhatsappInput(true);
                  }
                }}
                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-green-950/30"
                title="Compartir por WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar WhatsApp</span>
              </button>

              {/* 1. PRIMARY PRINT TICKET BUTTON */}
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 border border-emerald-500/40"
                title="Imprimir ticket en impresora térmica"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ticket</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
