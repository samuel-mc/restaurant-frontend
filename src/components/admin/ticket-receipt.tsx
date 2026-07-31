"use client";

import React, { useId } from "react";
import { QRCodeSVG } from "qrcode.react";

export interface TicketItemModifier {
  name: string;
  priceDelta?: number;
}

export interface TicketItem {
  id: string | number;
  quantity: number;
  name: string;
  price: number;
  modifiers?: TicketItemModifier[];
  notes?: string;
}

export interface TicketReceiptProps {
  restaurantName?: string;
  rfc?: string;
  address?: string;
  phone?: string;
  dateTime?: string;
  folio?: string;
  tableNumber?: string;
  waiterName?: string;
  items?: TicketItem[];
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  qrUrl?: string;
  qrCaption?: string;
  customNote?: string;
  isPrintOnlyMode?: boolean;
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

export function TicketReceipt({
  restaurantName = "La Trattoria",
  rfc = "TRA980415-HK2",
  address = "Av. Revolución 1234, Col. Condesa, CDMX",
  phone = "(55) 8765-4321",
  dateTime = "31/07/2026 15:20",
  folio = "#1084",
  tableNumber = "Mesa 4",
  waiterName = "Carlos M.",
  items = DEFAULT_ITEMS,
  subtotal,
  taxAmount,
  total,
  qrUrl = "https://platolisto.com/feedback/mesa-4",
  qrCaption = "Escanea el QR para calificar tu experiencia",
  customNote = "¡Gracias por su preferencia!",
  isPrintOnlyMode = false,
}: TicketReceiptProps) {
  const qrId = useId();

  // Calculations
  const computedSubtotal =
    subtotal ??
    items.reduce((acc, item) => {
      const modTotal =
        item.modifiers?.reduce((mAcc, m) => mAcc + (m.priceDelta || 0), 0) || 0;
      return acc + (item.price + modTotal * item.quantity);
    }, 0);

  const computedTax = taxAmount ?? computedSubtotal * 0.16;
  const computedTotal = total ?? computedSubtotal;

  const tip10 = computedTotal * 0.1;
  const tip15 = computedTotal * 0.15;
  const tip18 = computedTotal * 0.18;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div
      id="thermal-receipt-printable"
      className={`thermal-receipt-container font-mono text-xs text-black bg-white w-[302px] mx-auto select-none ${
        isPrintOnlyMode
          ? "p-0"
          : "shadow-2xl rounded-sm p-4 relative border-t-4 border-b-4 border-dashed border-slate-300"
      }`}
      style={{
        boxSizing: "border-box",
        wordBreak: "break-word",
      }}
    >
      {/* Visual thermal paper zig-zag top edge indicator (Screen view only) */}
      {!isPrintOnlyMode && (
        <div
          className="absolute -top-3 left-0 right-0 h-3 bg-repeat-x pointer-events-none opacity-80"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M0 12 L6 0 L12 12 Z'/%3E%3C/svg%3E")`,
            backgroundSize: "12px 12px",
          }}
          aria-hidden="true"
        />
      )}

      {/* HEADER BLOCK */}
      <div className="text-center space-y-1 pb-3 border-b border-black">
        <h1 className="text-base font-black tracking-wider uppercase leading-tight">
          *** {restaurantName} ***
        </h1>
        <p className="text-[11px] leading-tight">RFC: {rfc}</p>
        <p className="text-[10px] leading-tight text-slate-700 px-2">
          {address}
        </p>
        <p className="text-[11px]">Tel: {phone}</p>
      </div>

      {/* META / ORDER INFO BLOCK */}
      <div className="py-2.5 border-b border-black space-y-1 text-[11px]">
        <div className="flex justify-between items-center">
          <span>FOLIO: <strong className="text-xs">{folio}</strong></span>
          <span>{dateTime}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>MESERO: {waiterName}</span>
          <span className="bg-black text-white px-1.5 py-0.5 font-bold text-xs rounded-sm">
            {tableNumber.toUpperCase()}
          </span>
        </div>
        <div className="text-center font-bold text-[10px] tracking-widest pt-1">
          === PRE-CUENTA ===
        </div>
      </div>

      {/* ITEMS CONSUMPTION TABLE */}
      <div className="py-2.5 border-b border-black">
        <div className="flex justify-between text-[10px] font-bold pb-1 border-b border-dashed border-slate-400 uppercase">
          <span className="w-8/12">Cant / Concepto</span>
          <span className="w-4/12 text-right">Importe</span>
        </div>

        <ul className="divide-y divide-dashed divide-slate-200">
          {items.map((item) => {
            const itemTotal = item.price;
            return (
              <li key={item.id} className="py-1.5">
                <div className="flex justify-between items-start font-semibold">
                  <span className="w-8/12 pr-1">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="w-4/12 text-right tabular-nums">
                    {formatCurrency(itemTotal)}
                  </span>
                </div>

                {/* MODIFIERS / EXTRAS */}
                {item.modifiers && item.modifiers.length > 0 && (
                  <ul className="pl-3 text-[10px] text-slate-700 space-y-0.5 mt-0.5">
                    {item.modifiers.map((mod, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>+ {mod.name}</span>
                        {mod.priceDelta ? (
                          <span className="tabular-nums">
                            (+{formatCurrency(mod.priceDelta)})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {/* ITEM NOTES */}
                {item.notes && (
                  <p className="pl-3 text-[10px] italic text-slate-600">
                    Obs: {item.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* TOTALS SECTION */}
      <div className="py-2.5 border-b border-black space-y-1.5 text-right">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-600">Subtotal:</span>
          <span className="tabular-nums">{formatCurrency(computedSubtotal)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>IVA (16% Incluido):</span>
          <span className="tabular-nums">{formatCurrency(computedTax)}</span>
        </div>
        <div className="flex justify-between items-baseline pt-1.5 border-t border-black text-sm">
          <span className="font-extrabold uppercase tracking-wide">TOTAL:</span>
          <span className="font-black text-base tabular-nums">
            {formatCurrency(computedTotal)}
          </span>
        </div>
      </div>

      {/* SUGERENCIA DE PROPINA (NO OBLIGATORIA) */}
      <div className="my-3 p-2 border border-dashed border-black text-center space-y-1 bg-slate-50">
        <p className="font-bold text-[10px] uppercase tracking-wider">
          -- SUGERENCIA DE PROPINA --
        </p>
        <p className="text-[9px] text-slate-600 italic leading-none pb-1">
          (No obligatoria)
        </p>
        <div className="grid grid-cols-3 gap-1 text-[10px] pt-1 border-t border-slate-300">
          <div>
            <span className="block font-bold">10%</span>
            <span className="tabular-nums block">{formatCurrency(tip10)}</span>
          </div>
          <div>
            <span className="block font-bold">15%</span>
            <span className="tabular-nums block">{formatCurrency(tip15)}</span>
          </div>
          <div>
            <span className="block font-bold">18%</span>
            <span className="tabular-nums block">{formatCurrency(tip18)}</span>
          </div>
        </div>
      </div>

      {/* FOOTER & QR CODE SMART RATING */}
      <div className="text-center pt-2 space-y-2">
        <p className="font-bold text-[11px]">{customNote}</p>

        {/* QR CODE DISPLAY */}
        <div className="flex flex-col items-center justify-center pt-1">
          <div className="p-1.5 bg-white border border-slate-300 rounded inline-block">
            <QRCodeSVG
              id={qrId}
              value={qrUrl}
              size={84}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="text-[9.5px] leading-tight text-slate-700 max-w-[200px] mt-1.5 italic">
            "{qrCaption}"
          </p>
        </div>

        <div className="text-[9px] text-slate-500 tracking-widest pt-2">
          === PLATOLISTO POS ===
        </div>
      </div>

      {/* Visual thermal paper zig-zag bottom edge indicator (Screen view only) */}
      {!isPrintOnlyMode && (
        <div
          className="absolute -bottom-3 left-0 right-0 h-3 bg-repeat-x pointer-events-none opacity-80"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M0 0 L6 12 L12 0 Z'/%3E%3C/svg%3E")`,
            backgroundSize: "12px 12px",
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
