"use client";

/**
 * Modal táctil para unir mesas: paso 1 mesa principal → paso 2 mesas a vincular.
 * Paso 2 chunked: ocupadas primero, libres colapsables, filtro en pisos grandes.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, Link2, X } from "lucide-react";
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

const FILTER_THRESHOLD = 16;

function normalizeTableKey(value: string): string {
  return value.replace(/^(mesa\s*)/i, "").trim();
}

function matchesTableQuery(table: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return table.includes(q) || `mesa ${table}`.includes(q);
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
  const filterId = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [primary, setPrimary] = useState<string>("");
  const [secondaries, setSecondaries] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [tableQuery, setTableQuery] = useState("");
  const [showFreeTables, setShowFreeTables] = useState(false);

  const occupiedKeys = useMemo(() => {
    const keys = occupiedTables.map(normalizeTableKey).filter(Boolean);
    return Array.from(new Set(keys)).sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    );
  }, [occupiedTables]);

  const occupiedSet = useMemo(() => new Set(occupiedKeys), [occupiedKeys]);

  const secondaryCandidates = useMemo(() => {
    if (!primary) return [];
    const all = new Set<string>();
    for (let i = 1; i <= floorSize; i += 1) {
      all.add(String(i));
    }
    for (const t of occupiedKeys) {
      all.add(t);
    }
    all.delete(primary);
    return Array.from(all).sort((a, b) => {
      const aOcc = occupiedSet.has(a) ? 0 : 1;
      const bOcc = occupiedSet.has(b) ? 0 : 1;
      if (aOcc !== bOcc) return aOcc - bOcc;
      return a.localeCompare(b, "es", { numeric: true });
    });
  }, [floorSize, occupiedKeys, occupiedSet, primary]);

  const occupiedSecondaries = useMemo(
    () =>
      secondaryCandidates.filter(
        (t) => occupiedSet.has(t) && matchesTableQuery(t, tableQuery),
      ),
    [occupiedSet, secondaryCandidates, tableQuery],
  );

  const freeSecondaries = useMemo(
    () =>
      secondaryCandidates.filter(
        (t) => !occupiedSet.has(t) && matchesTableQuery(t, tableQuery),
      ),
    [occupiedSet, secondaryCandidates, tableQuery],
  );

  const freeTotal = useMemo(
    () => secondaryCandidates.filter((t) => !occupiedSet.has(t)).length,
    [occupiedSet, secondaryCandidates],
  );

  const showFilter = secondaryCandidates.length >= FILTER_THRESHOLD;

  const panelRef = useModalFocusTrap({
    open,
    onEscape: () => {
      if (busy) return;
      if (step === 2) {
        setStep(1);
        setLocalError(null);
        return;
      }
      onCancel();
    },
    escapeEnabled: !busy,
  });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPrimary("");
    setSecondaries([]);
    setLocalError(null);
    setTableQuery("");
    setShowFreeTables(false);
  }, [open]);

  if (!open) return null;

  function selectPrimary(table: string) {
    setLocalError(null);
    setPrimary(table);
    setSecondaries([]);
  }

  function toggleSecondary(table: string) {
    setLocalError(null);
    setSecondaries((prev) =>
      prev.includes(table)
        ? prev.filter((t) => t !== table)
        : [...prev, table],
    );
  }

  function goToSecondaries() {
    if (!primary) {
      setLocalError("Elige la mesa que conserva la cuenta.");
      return;
    }
    setLocalError(null);
    setTableQuery("");
    setShowFreeTables(freeTotal > 0 && freeTotal <= 8);
    setStep(2);
  }

  function handleConfirm() {
    if (!primary) {
      setLocalError("Elige la mesa principal.");
      setStep(1);
      return;
    }
    if (secondaries.length === 0) {
      setLocalError("Elige al menos una mesa a vincular.");
      return;
    }
    onConfirm(primary, secondaries);
  }

  const sortedSecondaries = [...secondaries].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true }),
  );

  function renderTableGrid(
    tables: string[],
    occupied: boolean,
    keyPrefix: string,
  ) {
    if (tables.length === 0) {
      return (
        <p className="py-2 text-sm text-muted-foreground">
          {tableQuery.trim()
            ? "Ninguna mesa coincide."
            : occupied
              ? "No hay otras mesas con cuenta."
              : "No hay mesas libres en el rango."}
        </p>
      );
    }
    return (
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {tables.map((table) => {
          const selected = secondaries.includes(table);
          return (
            <li key={`${keyPrefix}-${table}`}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={selected}
                data-testid={`merge-secondary-${table}`}
                onClick={() => toggleSecondary(table)}
                className={`min-h-12 w-full rounded-xl text-sm font-bold tabular-nums ${focusRing} ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : occupied
                      ? "border border-border bg-secondary"
                      : "border border-dashed border-border bg-background text-muted-foreground"
                }`}
              >
                <span className="sr-only">
                  {occupied ? "Mesa ocupada " : "Mesa libre "}
                </span>
                {table}
              </button>
            </li>
          );
        })}
      </ul>
    );
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
        data-testid="merge-tables-modal"
        className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              Paso {step} de 2
            </p>
            <h2 id={titleId} className="mt-0.5 text-xl font-bold tracking-tight">
              {step === 1 ? "Mesa principal" : "Mesas a vincular"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 1
                ? "Elige la mesa que conserva la cuenta abierta."
                : `Se unen a Mesa ${primary}. Puedes marcar varias.`}
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {step === 1 ? (
            occupiedKeys.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay cuentas abiertas para unir. Abre una mesa primero.
              </p>
            ) : (
              <ul className="grid max-h-[min(40dvh,20rem)] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                {occupiedKeys.map((table) => {
                  const selected = primary === table;
                  return (
                    <li key={`primary-${table}`}>
                      <button
                        type="button"
                        disabled={busy}
                        aria-pressed={selected}
                        data-testid={`merge-primary-${table}`}
                        onClick={() => selectPrimary(table)}
                        className={`min-h-12 w-full rounded-xl text-sm font-bold tabular-nums ${focusRing} ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-secondary"
                        }`}
                      >
                        <span className="sr-only">Mesa </span>
                        {table}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <>
              {showFilter ? (
                <div>
                  <label
                    htmlFor={filterId}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Buscar mesa
                  </label>
                  <input
                    id={filterId}
                    type="search"
                    inputMode="numeric"
                    enterKeyHint="search"
                    placeholder="Ej. 12"
                    value={tableQuery}
                    onChange={(e) => setTableQuery(e.target.value)}
                    className={`mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm tabular-nums ${focusRing}`}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Con cuenta
                  <span className="ml-1.5 font-semibold normal-case tracking-normal tabular-nums text-foreground">
                    {occupiedSecondaries.length}
                  </span>
                </p>
                {renderTableGrid(occupiedSecondaries, true, "sec-occ")}
              </div>

              {freeTotal > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Libres
                      <span className="ml-1.5 font-semibold normal-case tracking-normal tabular-nums text-foreground">
                        {freeTotal}
                      </span>
                    </p>
                    {freeTotal > 8 ? (
                      <button
                        type="button"
                        onClick={() => setShowFreeTables((v) => !v)}
                        className={`text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline ${focusRing}`}
                      >
                        {showFreeTables ? "Ocultar" : "Mostrar"}
                      </button>
                    ) : null}
                  </div>
                  {showFreeTables || freeTotal <= 8
                    ? renderTableGrid(freeSecondaries, false, "sec-free")
                    : (
                        <p className="text-sm text-muted-foreground">
                          Ocultas para no saturar. Úsalas solo si la mesa
                          vinculada aún no tiene cuenta.
                        </p>
                      )}
                </div>
              ) : null}

              {secondaries.length > 0 ? (
                <p className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border">
                  <Link2 className="size-4 shrink-0" aria-hidden />
                  <span>
                    Resultado:{" "}
                    <span className="font-bold">
                      Mesa {[primary, ...sortedSecondaries].join("-")}
                    </span>
                  </span>
                </p>
              ) : null}
            </>
          )}

          {localError || error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {localError || error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          {step === 1 ? (
            <>
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
                disabled={busy || !primary || occupiedKeys.length === 0}
                data-testid="merge-continue"
                onClick={goToSecondaries}
                className={`inline-flex min-h-12 flex-[1.4] items-center justify-center rounded-xl border border-border bg-secondary px-3 text-sm font-bold text-foreground ${focusRing} disabled:opacity-50`}
              >
                Continuar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep(1);
                  setLocalError(null);
                }}
                className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold ${focusRing}`}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Atrás
              </button>
              <button
                type="button"
                disabled={busy || secondaries.length === 0}
                data-testid="merge-confirm"
                onClick={handleConfirm}
                className={`inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-bold text-foreground ${focusRing} disabled:opacity-50`}
              >
                <Link2 className="size-4" aria-hidden />
                {busy ? "Uniendo…" : "Unir mesas"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
