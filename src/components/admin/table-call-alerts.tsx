"use client";

/**
 * Banner de alertas TABLE_CALL en tablero mesero / pedidos.
 * Delight: CTA contextual (Cobrar / Adición / Ir) además de descartar.
 * Harden: no X mientras En curso; Limpiar solo avisa no parkados.
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

export interface TableCallPrimaryAction {
  label: string;
  /** Emerald for money moment (Cobrar). */
  tone?: "live" | "neutral";
}

interface TableCallAlertsProps {
  calls: TableCallResponse[];
  onDismiss: (id: string) => void;
  onDismissAll?: () => void;
  /** Call currently parked in Cobrar/POS — stays visible as “En curso”. */
  inProgressCallId?: string | null;
  getPrimaryAction?: (
    call: TableCallResponse,
  ) => TableCallPrimaryAction | null;
  onPrimaryAction?: (call: TableCallResponse) => void;
}

export function TableCallAlerts({
  calls,
  onDismiss,
  onDismissAll,
  inProgressCallId = null,
  getPrimaryAction,
  onPrimaryAction,
}: TableCallAlertsProps) {
  if (calls.length === 0) return null;

  const clearableCount = calls.filter((c) => c.id !== inProgressCallId).length;
  const hasParked = Boolean(
    inProgressCallId && calls.some((c) => c.id === inProgressCallId),
  );

  return (
    <div
      className="space-y-2"
      role="region"
      aria-label="Llamadas de mesa"
      aria-live="assertive"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-warn-ink">
          Atención en mesa · {calls.length}
        </p>
        {clearableCount > 0 && onDismissAll ? (
          <button
            type="button"
            onClick={onDismissAll}
            className={`text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline ${focusRing}`}
          >
            {hasParked ? "Limpiar otras" : "Limpiar todas"}
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {calls.map((call) => {
          const Icon = call.callType === "BILL" ? Receipt : Bell;
          const inProgress = inProgressCallId === call.id;
          const action = getPrimaryAction?.(call) ?? null;
          return (
            <li
              key={call.id}
              className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-start ${
                inProgress
                  ? "border-border bg-secondary text-foreground"
                  : "border-warn/40 bg-warn-muted text-warn-ink"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-card/80">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold tracking-tight">
                      {formatTableLabel(call.tableNumber)}
                    </p>
                    {inProgress ? (
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                        En curso
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium">{callTitle(call)}</p>
                  {call.note?.trim() ? (
                    <p className="mt-1 text-xs opacity-90">{call.note.trim()}</p>
                  ) : null}
                </div>
                {!inProgress ? (
                  <button
                    type="button"
                    onClick={() => onDismiss(call.id)}
                    aria-label={`Descartar aviso de ${formatTableLabel(call.tableNumber)}`}
                    className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card/70 sm:hidden ${focusRing}`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {action && onPrimaryAction && !inProgress ? (
                  <button
                    type="button"
                    onClick={() => onPrimaryAction(call)}
                    className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold sm:flex-none ${focusRing} ${
                      action.tone === "live"
                        ? "bg-live text-live-foreground"
                        : "bg-card text-foreground"
                    }`}
                  >
                    {action.label}
                  </button>
                ) : null}
                {inProgress ? (
                  <p className="text-xs font-semibold text-muted-foreground sm:max-w-[9rem] sm:text-right">
                    Termina Cobrar o la comanda para cerrar este aviso.
                  </p>
                ) : null}
                {!inProgress ? (
                  <button
                    type="button"
                    onClick={() => onDismiss(call.id)}
                    aria-label={`Descartar aviso de ${formatTableLabel(call.tableNumber)}`}
                    className={`hidden size-10 shrink-0 items-center justify-center rounded-full bg-card/70 sm:inline-flex ${focusRing}`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
