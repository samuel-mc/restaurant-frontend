"use client";

import { useId } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatCurrency } from "@/lib/format";

export interface TicketItemModifier {
  name: string;
  priceDelta?: number;
}

export interface TicketItem {
  id: string | number;
  quantity: number;
  name: string;
  /** Importe total de la línea (incluye modificadores). */
  price: number;
  /** Precio unitario base (opcional, solo informativo). */
  unitPrice?: number;
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
  /** Prefijo del bloque meta: PRE-CUENTA o CUENTA. */
  ticketKind?: "pre-cuenta" | "cuenta";
}

/**
 * Ticket térmico ~80mm. `price` por ítem = importe de línea (no se vuelven a sumar mods).
 */
export function TicketReceipt({
  restaurantName = "Restaurante",
  rfc,
  address,
  phone,
  dateTime,
  folio = "—",
  tableNumber = "—",
  waiterName,
  items = [],
  subtotal,
  taxAmount,
  total,
  qrUrl,
  qrCaption = "Escanea para más información",
  customNote = "¡Gracias por su preferencia!",
  isPrintOnlyMode = false,
  ticketKind = "pre-cuenta",
}: TicketReceiptProps) {
  const qrId = useId();

  const computedSubtotal =
    subtotal ?? items.reduce((acc, item) => acc + item.price, 0);
  const computedTotal = total ?? computedSubtotal;
  const computedTax =
    taxAmount ??
    (computedTotal > 0 ? computedTotal - computedTotal / 1.16 : 0);

  const tip10 = computedTotal * 0.1;
  const tip15 = computedTotal * 0.15;
  const tip18 = computedTotal * 0.18;

  const kindLabel = ticketKind === "cuenta" ? "CUENTA" : "PRE-CUENTA";

  return (
    <div
      id={isPrintOnlyMode ? "thermal-receipt-printable" : undefined}
      className={`thermal-receipt-container mx-auto w-[302px] select-none bg-white font-mono text-xs text-black ${
        isPrintOnlyMode
          ? "p-0"
          : "relative rounded-sm border-y-4 border-dashed border-slate-300 p-4 shadow-2xl"
      }`}
      style={{
        boxSizing: "border-box",
        wordBreak: "break-word",
      }}
    >
      {!isPrintOnlyMode ? (
        <div
          className="pointer-events-none absolute -top-3 left-0 right-0 h-3 bg-repeat-x opacity-80"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M0 12 L6 0 L12 12 Z'/%3E%3C/svg%3E")`,
            backgroundSize: "12px 12px",
          }}
          aria-hidden
        />
      ) : null}

      <div className="space-y-1 border-b border-black pb-3 text-center">
        <h1 className="text-base font-black uppercase leading-tight tracking-wider">
          *** {restaurantName} ***
        </h1>
        {rfc ? (
          <p className="text-[11px] leading-tight">RFC: {rfc}</p>
        ) : null}
        {address ? (
          <p className="px-2 text-[10px] leading-tight text-slate-700">
            {address}
          </p>
        ) : null}
        {phone ? <p className="text-[11px]">Tel: {phone}</p> : null}
      </div>

      <div className="space-y-1 border-b border-black py-2.5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span>
            FOLIO: <strong className="text-xs">{folio}</strong>
          </span>
          {dateTime ? <span className="shrink-0">{dateTime}</span> : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            {waiterName ? `MESERO: ${waiterName}` : "MESERO: —"}
          </span>
          <span className="shrink-0 rounded-sm bg-black px-1.5 py-0.5 text-xs font-bold text-white">
            {tableNumber.toUpperCase()}
          </span>
        </div>
        <div className="pt-1 text-center text-[10px] font-bold tracking-widest">
          === {kindLabel} ===
        </div>
      </div>

      <div className="border-b border-black py-2.5">
        <div className="flex justify-between border-b border-dashed border-slate-400 pb-1 text-[10px] font-bold uppercase">
          <span className="w-8/12">Cant / Concepto</span>
          <span className="w-4/12 text-right">Importe</span>
        </div>

        {items.length === 0 ? (
          <p className="py-3 text-center text-[10px] text-slate-500">
            Sin consumos
          </p>
        ) : (
          <ul className="divide-y divide-dashed divide-slate-200">
            {items.map((item) => (
              <li key={item.id} className="py-1.5">
                <div className="flex items-start justify-between font-semibold">
                  <span className="w-8/12 pr-1">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="w-4/12 text-right tabular-nums">
                    {formatCurrency(item.price)}
                  </span>
                </div>

                {item.modifiers && item.modifiers.length > 0 ? (
                  <ul className="mt-0.5 space-y-0.5 pl-3 text-[10px] text-slate-700">
                    {item.modifiers.map((mod, idx) => (
                      <li key={`${item.id}-mod-${idx}`} className="flex justify-between gap-2">
                        <span>+ {mod.name}</span>
                        {mod.priceDelta ? (
                          <span className="tabular-nums">
                            (+{formatCurrency(mod.priceDelta)})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {item.notes ? (
                  <p className="pl-3 text-[10px] italic text-slate-600">
                    Obs: {item.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5 border-b border-black py-2.5 text-right">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-600">Subtotal:</span>
          <span className="tabular-nums">
            {formatCurrency(computedSubtotal)}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>IVA (16% incluido):</span>
          <span className="tabular-nums">{formatCurrency(computedTax)}</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-black pt-1.5 text-sm">
          <span className="font-extrabold uppercase tracking-wide">TOTAL:</span>
          <span className="text-base font-black tabular-nums">
            {formatCurrency(computedTotal)}
          </span>
        </div>
      </div>

      <div className="my-3 space-y-1 border border-dashed border-black bg-slate-50 p-2 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider">
          -- Sugerencia de propina --
        </p>
        <p className="pb-1 text-[9px] italic leading-none text-slate-600">
          (No obligatoria)
        </p>
        <div className="grid grid-cols-3 gap-1 border-t border-slate-300 pt-1 text-[10px]">
          <div>
            <span className="block font-bold">10%</span>
            <span className="block tabular-nums">{formatCurrency(tip10)}</span>
          </div>
          <div>
            <span className="block font-bold">15%</span>
            <span className="block tabular-nums">{formatCurrency(tip15)}</span>
          </div>
          <div>
            <span className="block font-bold">18%</span>
            <span className="block tabular-nums">{formatCurrency(tip18)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 text-center">
        <p className="text-[11px] font-bold">{customNote}</p>

        {qrUrl ? (
          <div className="flex flex-col items-center justify-center pt-1">
            <div className="inline-block rounded border border-slate-300 bg-white p-1.5">
              <QRCodeSVG
                id={qrId}
                value={qrUrl}
                size={84}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-1.5 max-w-[200px] text-[9.5px] italic leading-tight text-slate-700">
              &ldquo;{qrCaption}&rdquo;
            </p>
          </div>
        ) : null}

        <div className="pt-2 text-[9px] tracking-widest text-slate-500">
          === PLATOLISTO ===
        </div>
      </div>

      {!isPrintOnlyMode ? (
        <div
          className="pointer-events-none absolute -bottom-3 left-0 right-0 h-3 bg-repeat-x opacity-80"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M0 0 L6 12 L12 0 Z'/%3E%3C/svg%3E")`,
            backgroundSize: "12px 12px",
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
