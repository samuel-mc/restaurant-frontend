"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  CreditCard,
  DollarSign,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Star,
  TrendingUp,
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

  async function handleCloseShift() {
    setBusyClose(true);
    setError(null);
    try {
      const record = await postCloseShift(tenantSlug);
      setCorteZRecord(record);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No pudimos procesar el cierre de caja.",
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-live-ink">
            PlatoListo POS · {restaurantName}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
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
            className={`${focusRing} inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60`}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCloseShift()}
            disabled={busyClose || loading}
            className={`${focusRing} inline-flex min-h-10 items-center gap-2 rounded-xl bg-live px-4 text-xs font-extrabold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-60`}
          >
            <Printer className="size-4" />
            <span>{busyClose ? "Generando..." : "🖨️ Imprimir Corte Z"}</span>
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {/* Grid de Tarjetas KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
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
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
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
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
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
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            Satisfacción media del comensal
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Desglose por Método de Pago */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h3 className="text-base font-bold tracking-tight">Desglose por Método de Pago</h3>
            <p className="text-xs text-muted-foreground">
              Desglose real por método de cobro (órdenes cerradas del día).
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Banknote className="size-4 text-emerald-500" />
                  <span>Efectivo</span>
                </div>
                <span className="tabular-nums font-bold">{formatCurrency(cashAmount)}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-sky-500" />
                  <span>Tarjeta (Débito/Crédito)</span>
                </div>
                <span className="tabular-nums font-bold">{formatCurrency(cardAmount)}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4 text-purple-500" />
                  <span>Transferencia / Digital</span>
                </div>
                <span className="tabular-nums font-bold">{formatCurrency(transferAmount)}</span>
              </div>
            </div>
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

          {!data?.topProducts || data.topProducts.length === 0 ? (
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
                    <span className="truncate text-xs font-bold text-foreground">
                      {prod.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-extrabold tabular-nums">
                      {formatCurrency(prod.revenue)}
                    </span>
                    <span className="block text-[0.65rem] text-muted-foreground">
                      {prod.quantity} unidades sold
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {corteZRecord ? (
        <CorteZTicket record={corteZRecord} onClose={() => setCorteZRecord(null)} />
      ) : null}
    </div>
  );
}
