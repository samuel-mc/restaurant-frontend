import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { AdminRovingTablist } from "@/components/admin/admin-roving-tablist";
import { AnalyticsCharts } from "@/components/admin/analytics-charts";
import { AnalyticsKpiGrid } from "@/components/admin/analytics-kpi-grid";
import {
  ANALYTICS_PERIODS,
  analyticsPeriodMeta,
} from "@/lib/analytics-period";
import type { AnalyticsPeriod, AnalyticsSummary } from "@/types/analytics";

interface AnalyticsOverviewProps {
  summary: AnalyticsSummary;
  period: AnalyticsPeriod;
  loadError?: boolean;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Bloque de analíticas: KPIs (server-friendly) + gráficos client.
 */
export function AnalyticsOverview({
  summary,
  period,
  loadError = false,
}: AnalyticsOverviewProps) {
  const meta = analyticsPeriodMeta(period);

  return (
    <div className="font-jakarta-sans">
      <header className="border-b border-border px-4 py-5 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Facturación, pedidos y platillos más vendidos.
            </p>
          </div>
          <AdminRovingTablist
            aria-label="Periodo de métricas"
            className="flex flex-wrap gap-2"
          >
            {ANALYTICS_PERIODS.map((entry) => {
              const selected = entry.id === period;
              return (
                <Link
                  key={entry.id}
                  href={`/admin/dashboard?period=${entry.id}`}
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  scroll={false}
                  className={`inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-bold transition-colors ${focusRing} ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {entry.label}
                </Link>
              );
            })}
          </AdminRovingTablist>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:space-y-6 md:px-6 md:py-6">
        {loadError ? (
          <div
            role="alert"
            className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"
          >
            <h2 className="text-lg font-bold tracking-tight">
              No pudimos cargar las métricas
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Revisa la conexión e inténtalo de nuevo. No mostramos ceros para no
              confundirlos con un periodo sin ventas.
            </p>
            <Link
              href={`/admin/dashboard?period=${period}`}
              className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground ${focusRing}`}
            >
              <RefreshCw className="size-4" aria-hidden />
              Reintentar
            </Link>
          </div>
        ) : (
          <>
            <AnalyticsKpiGrid
              kpis={summary.kpis}
              comparisonLabel={meta.comparisonLabel}
            />
            <AnalyticsCharts
              salesTimeline={summary.salesTimeline}
              topProducts={summary.topProducts}
            />
          </>
        )}
      </div>
    </div>
  );
}
