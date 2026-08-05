"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  beginThermalPrint,
  clearThermalPrintArtifacts,
} from "@/lib/thermal-print";
import type { ShiftCloseRecord } from "@/types/analytics";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface CorteZTicketProps {
  record: ShiftCloseRecord;
  onClose?: () => void;
}

export function CorteZTicket({ record, onClose }: CorteZTicketProps) {
  useEffect(() => {
    function onAfterPrint() {
      clearThermalPrintArtifacts();
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      clearThermalPrintArtifacts();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) {
        onClose();
      } else if ((e.key === "p" || e.key === "P") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handlePrint();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePrint() {
    if (typeof window === "undefined") return;
    beginThermalPrint();
    window.setTimeout(() => {
      try {
        window.print();
      } catch {
        clearThermalPrintArtifacts();
      }
    }, 50);
  }

  const dateStr = record.closedAt
    ? new Date(record.closedAt).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : new Date().toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      });

  const printSheet =
    typeof document !== "undefined"
      ? createPortal(
          <div className="thermal-print-sheet" aria-hidden>
            <div
              id="corte-z-printable"
              className="thermal-receipt-container mx-auto w-[302px] border border-black bg-white p-3 font-mono text-xs text-black"
              style={{ boxSizing: "border-box", wordBreak: "break-word" }}
            >
              <CorteZBody record={record} dateStr={dateStr} />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {printSheet}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:hidden">
        <div className="flex max-h-[90vh] flex-col rounded-2xl bg-card p-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold">Cierre de Caja (Corte Z)</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className={`${focusRing} flex min-h-9 items-center gap-1.5 rounded-xl bg-live px-3 text-xs font-bold text-white shadow-sm hover:opacity-90`}
              >
                <Printer className="size-4" />
                <span>Imprimir Corte Z</span>
              </button>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={`${focusRing} rounded-lg p-1.5 text-muted-foreground hover:bg-secondary`}
                  aria-label="Cerrar modal"
                >
                  <X className="size-5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-y-auto pt-3">
            <div
              className="thermal-receipt-container mx-auto w-[302px] border border-black bg-white p-3 font-mono text-xs text-black"
              style={{ boxSizing: "border-box", wordBreak: "break-word" }}
            >
              <CorteZBody record={record} dateStr={dateStr} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CorteZBody({
  record,
  dateStr,
}: {
  record: ShiftCloseRecord;
  dateStr: string;
}) {
  return (
    <>
      <div className="space-y-1 border-b border-black pb-2 text-center">
        <h1 className="text-sm font-black uppercase tracking-wider leading-tight">
          *** {record.restaurantName || "RESTAURANTE"} ***
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest">
          CIERRE DE CAJA / CORTE Z
        </p>
        <p className="text-[10px]">ID: {record.id}</p>
        <p className="text-[10px]">FECHA: {dateStr}</p>
        <p className="text-[10px]">AUDITOR: {record.closedBy}</p>
      </div>

      <div className="py-2 text-[11px]">
        <div className="text-center font-bold tracking-widest text-[10px]">
          === RESUMEN OPERATIVO ===
        </div>
        <div className="mt-1 space-y-1">
          <div className="flex justify-between">
            <span>VENTA TOTAL:</span>
            <strong className="tabular-nums">
              {formatCurrency(record.totalSales)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>COMANDAS CERRADAS:</span>
            <span className="tabular-nums">{record.totalClosedOrders}</span>
          </div>
          <div className="flex justify-between">
            <span>TICKET PROMEDIO:</span>
            <span className="tabular-nums">
              {formatCurrency(record.averageTicket)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SMART RATING:</span>
            <span className="tabular-nums">{record.averageRating} ★ / 5★</span>
          </div>
        </div>
      </div>

      <div className="border-t border-black py-2 text-[11px]">
        <div className="text-center font-bold tracking-widest text-[10px]">
          === MÉTODOS DE PAGO ===
        </div>
        <div className="mt-1 space-y-1">
          <div className="flex justify-between">
            <span>EFECTIVO:</span>
            <span className="tabular-nums">
              {formatCurrency(record.paymentMethods?.EFECTIVO ?? 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>TARJETA:</span>
            <span className="tabular-nums">
              {formatCurrency(record.paymentMethods?.TARJETA ?? 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>TRANSFERENCIA:</span>
            <span className="tabular-nums">
              {formatCurrency(record.paymentMethods?.TRANSFERENCIA ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {record.topProducts && record.topProducts.length > 0 ? (
        <div className="border-t border-black py-2 text-[10px]">
          <div className="text-center font-bold tracking-widest text-[10px]">
            === TOP 5 PRODUCTOS ===
          </div>
          <div className="mt-1 flex justify-between font-bold border-b border-dashed border-black pb-0.5">
            <span>CANT / PRODUCTO</span>
            <span>TOTAL</span>
          </div>
          <ul className="mt-1 space-y-1">
            {record.topProducts.map((p, i) => (
              <li key={i} className="flex justify-between items-start gap-1">
                <span className="truncate pr-1">
                  {p.quantity}x {p.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCurrency(p.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-black pt-4 pb-2 text-center text-[9px] space-y-4">
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="border-t border-black pt-1">FIRMA CAJERO</div>
          <div className="border-t border-black pt-1">FIRMA MANAGER</div>
        </div>
        <p className="font-bold tracking-wider">[ REGISTRO AUDITADO Y CERRADO ]</p>
        <p className="tracking-widest">=== PLATOLISTO POS ===</p>
      </div>
    </>
  );
}
