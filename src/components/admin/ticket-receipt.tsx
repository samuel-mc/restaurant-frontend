"use client";

import { useId } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatCurrency } from "@/lib/format";
import { ticketTipSuggestions } from "@/lib/ticket-from-order";

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
  /** IVA incluido en el total (informativo; no se suma otra vez). */
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
 * Ticket térmico ~80mm. Preview = papel: misma tipografía, bordes y tip box
 * que salen en la impresora (sin teatro de perforado / sombra / rellenos).
 * `price` por ítem = importe de línea (no se vuelven a sumar mods).
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
  taxAmount,
  total,
  qrUrl,
  qrCaption = "Escanea para más información",
  customNote = "¡Gracias por su preferencia!",
  isPrintOnlyMode = false,
  ticketKind = "pre-cuenta",
}: TicketReceiptProps) {
  const qrId = useId();

  const itemsSum = items.reduce((acc, item) => acc + item.price, 0);
  const computedTotal = total ?? itemsSum;
  const computedTax =
    taxAmount ??
    (computedTotal > 0 ? computedTotal - computedTotal / 1.16 : 0);
  const tips = ticketTipSuggestions(computedTotal);
  const kindLabel = ticketKind === "cuenta" ? "CUENTA" : "PRE-CUENTA";

  return (
    <div
      id={isPrintOnlyMode ? "thermal-receipt-printable" : undefined}
      className="thermal-receipt-container mx-auto w-[302px] border border-black bg-white p-2 font-mono text-xs text-black print:w-[302px] print:p-0 print:m-0 print:border-none print:shadow-none print:bg-white print:text-black"
      style={{
        boxSizing: "border-box",
        wordBreak: "break-word",
      }}
    >
      <div className="space-y-1 border-b border-black pb-3 text-center">
        <h1 className="text-base font-black uppercase leading-tight tracking-wider">
          *** {restaurantName} ***
        </h1>
        {rfc ? (
          <p className="text-[11px] leading-tight">RFC: {rfc}</p>
        ) : null}
        {address ? (
          <p className="px-2 text-[10px] leading-tight">{address}</p>
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
          <span className="shrink-0 bg-black px-1.5 py-0.5 text-xs font-bold text-white">
            {tableNumber.toUpperCase()}
          </span>
        </div>
        <div className="pt-1 text-center text-[10px] font-bold tracking-widest">
          === {kindLabel} ===
        </div>
      </div>

      <div className="border-b border-black py-2.5">
        <div className="flex justify-between border-b border-dashed border-black pb-1 text-[10px] font-bold uppercase">
          <span className="w-8/12">Cant / Concepto</span>
          <span className="w-4/12 text-right">Importe</span>
        </div>

        {items.length === 0 ? (
          <p className="py-3 text-center text-[10px]">Sin consumos</p>
        ) : (
          <ul className="divide-y divide-dashed divide-black/30">
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
                  <ul className="mt-0.5 space-y-0.5 pl-3 text-[10px]">
                    {item.modifiers.map((mod, idx) => (
                      <li
                        key={`${item.id}-mod-${idx}`}
                        className="flex justify-between gap-2"
                      >
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
                  <p className="pl-3 text-[10px] italic">Obs: {item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5 border-b border-black py-2.5 text-right">
        <div className="flex justify-between text-[10px]">
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

      <div className="my-3 space-y-1.5 border border-dashed border-black p-2 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider">
          -- Sugerencia de propina --
        </p>
        <p className="pb-0.5 text-[9px] italic leading-none">(No obligatoria)</p>
        <div className="grid grid-cols-3 gap-1.5 border-t border-dashed border-black pt-1.5">
          {tips.map((tip) => (
            <div key={tip.label} className="space-y-0.5">
              <span className="block text-[11px] font-bold leading-none">
                {tip.label}
              </span>
              <span className="block text-[10px] tabular-nums leading-tight">
                {formatCurrency(tip.amount)}
              </span>
              <span className="block border-t border-dashed border-black/50 pt-0.5 text-[11px] font-bold tabular-nums leading-tight">
                {formatCurrency(tip.withTip)}
              </span>
            </div>
          ))}
        </div>
        <p className="pt-0.5 text-[10px] leading-none tracking-wide">
          % · propina · total c/propina
        </p>
      </div>

      <div className="space-y-2 pt-2 text-center">
        <p className="text-[11px] font-bold">{customNote}</p>

        {qrUrl ? (
          <div className="flex flex-col items-center justify-center pt-1">
            <div className="inline-block border border-black bg-white p-1">
              <QRCodeSVG
                id={qrId}
                value={qrUrl}
                size={84}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-1.5 max-w-[200px] text-[9.5px] italic leading-tight">
              &ldquo;{qrCaption}&rdquo;
            </p>
          </div>
        ) : null}

        <div className="pt-2 text-[9px] tracking-widest">=== PLATOLISTO ===</div>
      </div>
    </div>
  );
}
