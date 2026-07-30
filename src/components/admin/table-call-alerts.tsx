"use client";

/**
 * Banner de alertas TABLE_CALL en tablero mesero / pedidos.
 */

import { Bell, Receipt, X } from "lucide-react";
import type { TableCallPaymentMethod, TableCallResponse } from "@/types/api";
import { formatTableLabel } from "@/lib/table-session";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PAYMENT_LABEL: Record<TableCallPaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

function callTitle(call: TableCallResponse): string {
  if (call.callType === "BILL") {
    const pay = call.paymentMethod
      ? ` · ${PAYMENT_LABEL[call.paymentMethod]}`
      : "";
    return `Piden la cuenta${pay}`;
  }
  return "Llaman al mesero";
}

interface TableCallAlertsProps {
  calls: TableCallResponse[];
  onDismiss: (id: string) => void;
  onDismissAll?: () => void;
}

export function TableCallAlerts({
  calls,
  onDismiss,
  onDismissAll,
}: TableCallAlertsProps) {
  if (calls.length === 0) return null;

  return (
    <div
      className="space-y-2"
      role="region"
      aria-label="Llamadas de mesa"
      aria-live="assertive"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warn-ink">
          Atención en mesa · {calls.length}
        </p>
        {calls.length > 1 && onDismissAll ? (
          <button
            type="button"
            onClick={onDismissAll}
            className={`text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline ${focusRing}`}
          >
            Limpiar todas
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {calls.map((call) => {
          const Icon = call.callType === "BILL" ? Receipt : Bell;
          return (
            <li
              key={call.id}
              className="flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn-muted px-4 py-3 text-warn-ink"
            >
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-card/80">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold tracking-tight">
                  {formatTableLabel(call.tableNumber)}
                </p>
                <p className="text-sm font-medium">{callTitle(call)}</p>
                {call.note?.trim() ? (
                  <p className="mt-1 text-xs opacity-90">{call.note.trim()}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(call.id)}
                aria-label={`Descartar aviso de ${formatTableLabel(call.tableNumber)}`}
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card/70 ${focusRing}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
