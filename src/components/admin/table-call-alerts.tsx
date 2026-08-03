"use client";

/**
 * Banner de alertas TABLE_CALL en tablero mesero / pedidos.
 * Distill: una interrupción visible a la vez (+ En curso); el resto en “N más”.
 * Harden: no X mientras En curso; Limpiar solo avisa no parkados.
 */

import { useEffect, useState } from "react";
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

function formatCallElapsed(iso: string, nowMs: number): string | null {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.floor((nowMs - then) / 60_000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
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
  /** Wall clock for elapsed labels (board ticks). */
  nowMs?: number;
  /** Keyboard-armed target — flash + expand if in overflow. */
  highlightedCallId?: string | null;
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
  nowMs = Date.now(),
  highlightedCallId = null,
  getPrimaryAction,
  onPrimaryAction,
}: TableCallAlertsProps) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const overflow =
      calls.filter((c) => c.id !== inProgressCallId).length - 1;
    if (overflow <= 0) setShowAll(false);
  }, [calls, inProgressCallId]);

  useEffect(() => {
    if (!highlightedCallId) return;
    const queue = calls.filter((c) => c.id !== inProgressCallId);
    const isOverflow = queue.slice(1).some((c) => c.id === highlightedCallId);
    if (isOverflow) setShowAll(true);
  }, [highlightedCallId, calls, inProgressCallId]);

  if (calls.length === 0) return null;

  const parked = inProgressCallId
    ? calls.find((c) => c.id === inProgressCallId)
    : undefined;
  const queue = calls.filter((c) => c.id !== inProgressCallId);
  const next = queue[0];
  const overflow = queue.slice(1);

  const visible: TableCallResponse[] = [];
  if (parked) visible.push(parked);
  if (next) visible.push(next);
  if (showAll) visible.push(...overflow);

  const clearableCount = queue.length;
  const hasParked = Boolean(parked);
  const hiddenCount = showAll ? 0 : overflow.length;

  return (
    <div
      className="sticky top-0 z-20 -mx-4 space-y-1.5 border-b border-border/40 bg-background/95 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      role="region"
      data-testid="table-call-alerts"
      aria-label="Llamadas de mesa"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-warn-ink">
          Atención · {calls.length}
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
        {visible.map((call) => {
          const Icon = call.callType === "BILL" ? Receipt : Bell;
          const inProgress = inProgressCallId === call.id;
          const action = getPrimaryAction?.(call) ?? null;
          const elapsed = formatCallElapsed(call.createdAt, nowMs);
          return (
            <li
              key={call.id}
              id={`call-alert-${call.id}`}
              data-testid="table-call-alert"
              className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 transition-[box-shadow,border-color] sm:flex-row sm:items-start ${
                inProgress
                  ? "border-border bg-secondary text-foreground"
                  : "border-warn/40 bg-warn-muted text-warn-ink"
              } ${
                highlightedCallId === call.id
                  ? "border-warn ring-2 ring-warn/55"
                  : ""
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
                    {highlightedCallId === call.id && !inProgress ? (
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-warn-ink ring-1 ring-warn/40">
                        Enter otra vez
                      </span>
                    ) : null}
                    {elapsed ? (
                      <span
                        className={`text-xs font-medium tabular-nums ${
                          inProgress
                            ? "text-muted-foreground"
                            : "text-warn-ink/80"
                        }`}
                      >
                        {elapsed}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium">{callTitle(call)}</p>
                  {highlightedCallId === call.id && !inProgress ? (
                    <p
                      className="mt-1 text-xs font-semibold text-warn-ink"
                      aria-live="polite"
                    >
                      Aviso listo · Enter o C otra vez ejecuta{" "}
                      {action?.label ?? "la acción"}
                    </p>
                  ) : null}
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
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`text-xs font-semibold text-warn-ink underline-offset-2 hover:underline ${focusRing}`}
        >
          {hiddenCount === 1
            ? "1 más en espera"
            : `${hiddenCount} más en espera`}
        </button>
      ) : null}
      {showAll && overflow.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={`text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline ${focusRing}`}
        >
          Mostrar solo la siguiente
        </button>
      ) : null}
    </div>
  );
}
