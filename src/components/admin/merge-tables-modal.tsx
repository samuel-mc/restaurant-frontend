"use client";

/**
 * Modal táctil para unir mesas (mesa principal + secundarias).
 */

import { useEffect, useId, useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

export interface MergeTablesModalProps {
  open: boolean;
  /** Números de mesa ocupadas (con cuenta abierta). */
  occupiedTables: string[];
  /** Rango de mesas del piso (1..N) desde settings. */
  floorSize: number;
  busy?: boolean;
  error?: string | null;
  onConfirm: (primaryTable: string, secondaryTables: string[]) => void;
  onCancel: () => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function normalizeTableKey(value: string): string {
  return value.replace(/^(mesa\s*)/i, "").trim();
}

export function MergeTablesModal({
  open,
  occupiedTables,
  floorSize,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: MergeTablesModalProps) {
  const titleId = useId();
  const [primary, setPrimary] = useState<string>("");
  const [secondaries, setSecondaries] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onCancel,
    escapeEnabled: !busy,
  });

  const floorTables = useMemo(() => {
    const occupied = new Set(occupiedTables.map(normalizeTableKey));
    const all = new Set<string>();
    for (let i = 1; i <= floorSize; i += 1) {
      all.add(String(i));
    }
    for (const t of occupied) {
      if (t) all.add(t);
    }
    return Array.from(all).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    );
  }, [floorSize, occupiedTables]);

  useEffect(() => {
    if (!open) return;
    setPrimary("");
    setSecondaries([]);
    setLocalError(null);
  }, [open]);

  if (!open) return null;

  function toggleSecondary(table: string) {
    setLocalError(null);
    if (table === primary) return;
    setSecondaries((prev) =>
      prev.includes(table)
        ? prev.filter((t) => t !== table)
        : [...prev, table],
    );
  }

  function handlePrimaryChange(table: string) {
    setLocalError(null);
    setPrimary(table);
    setSecondaries((prev) => prev.filter((t) => t !== table));
  }

  function handleConfirm() {
    if (!primary) {
      setLocalError("Elige la mesa principal.");
      return;
    }
    if (secondaries.length === 0) {
      setLocalError("Elige al menos una mesa a vincular.");
      return;
    }
    onConfirm(primary, secondaries);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operación de piso
            </p>
            <h2 id={titleId} className="mt-0.5 text-xl font-bold tracking-tight">
              Unir mesas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              La cuenta queda en la mesa principal; las demás se vinculan.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary ${focusRing}`}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <p className="mb-2 text-sm font-semibold">Mesa principal</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {floorTables.map((table) => {
                const selected = primary === table;
                const occupied = occupiedTables
                  .map(normalizeTableKey)
                  .includes(table);
                return (
                  <button
                    key={`primary-${table}`}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePrimaryChange(table)}
                    className={`min-h-12 rounded-xl text-sm font-bold tabular-nums ${focusRing} ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : occupied
                          ? "border border-border bg-secondary"
                          : "border border-dashed border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {table}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold">Mesas a vincular</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {floorTables
                .filter((t) => t !== primary)
                .map((table) => {
                  const selected = secondaries.includes(table);
                  const occupied = occupiedTables
                    .map(normalizeTableKey)
                    .includes(table);
                  return (
                    <button
                      key={`sec-${table}`}
                      type="button"
                      disabled={busy || !primary}
                      onClick={() => toggleSecondary(table)}
                      className={`min-h-12 rounded-xl text-sm font-bold tabular-nums ${focusRing} ${
                        selected
                          ? "bg-live text-live-foreground"
                          : occupied
                            ? "border border-border bg-secondary"
                            : "border border-dashed border-border bg-background text-muted-foreground"
                      } disabled:opacity-40`}
                    >
                      {table}
                    </button>
                  );
                })}
            </div>
          </section>

          {primary && secondaries.length > 0 ? (
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm font-medium">
              Resultado:{" "}
              <span className="font-bold">
                🔗 Mesa {primary}-{secondaries.join("-")} (Unidas)
              </span>
            </p>
          ) : null}

          {localError || error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {localError || error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className={`inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground ${focusRing} disabled:opacity-50`}
          >
            <Link2 className="size-4" aria-hidden />
            {busy ? "Uniendo…" : "Unir mesas"}
          </button>
        </footer>
      </div>
    </div>
  );
}
