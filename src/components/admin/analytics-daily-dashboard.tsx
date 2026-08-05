"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  DollarSign,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  fetchDailySummary,
  postCloseShift,
} from "@/services/adminAnalyticsClientService";
import type { DailySummary, ShiftCloseRecord } from "@/types/analytics";
import { CorteZTicket } from "@/components/admin/corte-z-ticket";
import { ApiError } from "@/services/apiClient";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface AnalyticsDailyDashboardProps {
  tenantSlug: string;
  restaurantName: string;
}

export function AnalyticsDailyDashboard({
  tenantSlug,
  restaurantName,
}: AnalyticsDailyDashboardProps) {
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [corteZRecord, setCorteZRecord] = useState<ShiftCloseRecord | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [busyClose, setBusyClose] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await fetchDailySummary(tenantSlug);
      setData(summary);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No pudimos cargar el resumen del día.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Global keyboard shortcuts: Esc to dismiss modals/errors, 'R' to refresh when not typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputting = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if (e.key === "Escape") {
        if (showConfirmClose && !busyClose) {
          setShowConfirmClose(false);
        } else if (error) {
          setError(null);
        }
      } else if ((e.key === "r" || e.key === "R") && !isInputting && !e.metaKey && !e.ctrlKey) {
        if (!loading) {
          void load();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmClose, busyClose, error, loading, load]);

  async function handleConfirmCloseShift() {
    setBusyClose(true);
    setError(null);
    try {
      const record = await postCloseShift(tenantSlug);
      setCorteZRecord(record);
      setShowConfirmClose(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No pudimos procesar el cierre de caja. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setBusyClose(false);
    }
  }

  const totalSales = data?.totalSales ?? 0;
  const closedOrders = data?.totalClosedOrders ?? 0;
  const avgTicket = data?.averageTicket ?? 0;
  const avgRating = data?.averageRating ?? 5.0;

  const cashAmount = data?.paymentMethods?.EFECTIVO ?? 0;
  const cardAmount = data?.paymentMethods?.TARJETA ?? 0;
  const transferAmount = data?.paymentMethods?.TRANSFERENCIA ?? 0;

  const totalPayments = cashAmount + cardAmount + transferAmount;
  const cashPct = totalPayments > 0 ? (cashAmount / totalPayments) * 100 : 0;
  const cardPct = totalPayments > 0 ? (cardAmount / totalPayments) * 100 : 0;
  const transferPct = totalPayments > 0 ? (transferAmount / totalPayments) * 100 : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-live-ink">
              PlatoListo POS · {restaurantName}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Turno Activo
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Métricas Diarias y Corte Z
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Venta acumulada del turno, comandas auditadas y cierre de caja diario.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Presiona R para actualizar"
            className={`${focusRing} inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60`}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmClose(true)}
            disabled={busyClose || loading}
            className={`${focusRing} inline-flex min-h-10 items-center gap-2 rounded-xl bg-live px-4 text-xs font-extrabold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-60`}
          >
            <Printer className="size-4" />
            <span>Imprimir Corte Z</span>
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Descartar
          </button>
        </div>
      ) : null}

      {/* Grid de Tarjetas KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-7 w-32 rounded bg-muted" />
              <div className="mt-2 h-3 w-36 rounded bg-muted/60" />
            </div>
          ))
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Venta Total
                </span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="size-5" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight">
                {formatCurrency(totalSales)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Acumulado del día en curso
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Comandas Cerradas
                </span>
                <div className="rounded-xl bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                  <Receipt className="size-5" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight">
                {closedOrders}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cuentas atendidas y liquidadas
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ticket Promedio
                </span>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                  <TrendingUp className="size-5" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight">
                {formatCurrency(avgTicket)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Promedio gastado por mesa
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Smart Rating
                </span>
                <div className="rounded-xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
                  <Star className="size-5 fill-amber-400 text-amber-500" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight">
                {avgRating} <span className="text-sm font-normal text-muted-foreground">/ 5★</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Satisfacción media del comensal
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Desglose por Método de Pago */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h3 className="text-base font-bold tracking-tight">Desglose por Método de Pago</h3>
            <p className="text-xs text-muted-foreground">
              Desglose real por método de cobro (órdenes cerradas del día).
            </p>

            {loading ? (
              <div className="mt-4 space-y-3 animate-pulse">
                <div className="h-2.5 w-full rounded-full bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
              </div>
            ) : (
              <>
                {/* Visual Multi-Segment Bar */}
                <div
                  className="my-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-label="Distribución por método de pago"
                >
                  {cashPct > 0 && (
                    <div
                      style={{ width: `${cashPct}%` }}
                      className="bg-emerald-500 transition-all duration-300"
                      title={`Efectivo: ${cashPct.toFixed(1)}%`}
                    />
                  )}
                  {cardPct > 0 && (
                    <div
                      style={{ width: `${cardPct}%` }}
                      className="bg-sky-500 transition-all duration-300"
                      title={`Tarjeta: ${cardPct.toFixed(1)}%`}
                    />
                  )}
                  {transferPct > 0 && (
                    <div
                      style={{ width: `${transferPct}%` }}
                      className="bg-purple-500 transition-all duration-300"
                      title={`Transferencia: ${transferPct.toFixed(1)}%`}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Banknote className="size-4 text-emerald-500" />
                      <span>Efectivo</span>
                      {cashPct > 0 && (
                        <span className="text-muted-foreground text-xs font-normal">({cashPct.toFixed(0)}%)</span>
                      )}
                    </div>
                    <span className="tabular-nums font-bold">{formatCurrency(cashAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-sky-500" />
                      <span>Tarjeta (Débito/Crédito)</span>
                      {cardPct > 0 && (
                        <span className="text-muted-foreground text-xs font-normal">({cardPct.toFixed(0)}%)</span>
                      )}
                    </div>
                    <span className="tabular-nums font-bold">{formatCurrency(cardAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-4 text-purple-500" />
                      <span>Transferencia / Digital</span>
                      {transferPct > 0 && (
                        <span className="text-muted-foreground text-xs font-normal">({transferPct.toFixed(0)}%)</span>
                      )}
                    </div>
                    <span className="tabular-nums font-bold">{formatCurrency(transferAmount)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-3">
            <div className="flex justify-between text-xs font-extrabold uppercase">
              <span>Total Auditado</span>
              <span className="tabular-nums text-live">{formatCurrency(totalSales)}</span>
            </div>
          </div>
        </div>

        {/* Top 5 Platillos más Vendidos */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-live-ink" />
            <h3 className="text-base font-bold tracking-tight">Top 5 Platillos más Vendidos</h3>
          </div>
          <p className="text-xs text-muted-foreground">Productos estrella en facturación de hoy.</p>

          {loading ? (
            <div className="mt-4 space-y-3 animate-pulse">
              <div className="h-8 w-full rounded bg-muted" />
              <div className="h-8 w-full rounded bg-muted" />
              <div className="h-8 w-full rounded bg-muted" />
            </div>
          ) : !data?.topProducts || data.topProducts.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Aún no hay comandas registradas el día de hoy.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {data.topProducts.map((prod, idx) => (
                <li key={idx} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-foreground">
                      #{idx + 1}
                    </span>
                    <span className="truncate text-xs font-bold text-foreground" title={prod.name}>
                      {prod.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-extrabold tabular-nums">
                      {formatCurrency(prod.revenue)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {prod.quantity} unidades vendidas
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Corte Z / Shift Close */}
      {showConfirmClose ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-corte-z-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
                  <AlertTriangle className="size-6" />
                </div>
                <div>
                  <h2
                    id="confirm-corte-z-title"
                    className="text-lg font-bold tracking-tight text-foreground"
                  >
                    ¿Confirmar Cierre de Caja (Corte Z)?
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Esta acción consolidará las ventas del turno actual y generará la tira auditada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                disabled={busyClose}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Cerrar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="my-5 rounded-xl border border-border/80 bg-secondary/40 p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venta Acumulada:</span>
                <span className="font-extrabold tabular-nums">{formatCurrency(totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comandas Liquidadas:</span>
                <span className="font-bold tabular-nums">{closedOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efectivo en Caja:</span>
                <span className="font-bold tabular-nums">{formatCurrency(cashAmount)}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ⚠️ Una vez cerrado el turno, no se podrán agregar más ventas a este periodo.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                disabled={busyClose}
                className={`${focusRing} rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCloseShift()}
                disabled={busyClose}
                className={`${focusRing} inline-flex items-center gap-2 rounded-xl bg-live px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:opacity-90 active:scale-95 disabled:opacity-50`}
              >
                <Printer className="size-4" />
                <span>{busyClose ? "Cerrando turno..." : "Sí, Cerrar Caja y Generar Tira"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {corteZRecord ? (
        <CorteZTicket record={corteZRecord} onClose={() => setCorteZRecord(null)} />
      ) : null}
    </div>
  );
}

