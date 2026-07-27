import { AnalyticsCharts } from "@/components/admin/analytics-charts";
import { AnalyticsKpiGrid } from "@/components/admin/analytics-kpi-grid";
import type { AnalyticsSummary } from "@/types/analytics";

interface AnalyticsOverviewProps {
  summary: AnalyticsSummary;
}

function periodLabel(period: string): string {
  switch (period) {
    case "week":
      return "Últimos 7 días";
    case "year":
      return "Este año";
    default:
      return "Este mes";
  }
}

/**
 * Bloque de analíticas: KPIs (server-friendly) + gráficos client.
 */
export function AnalyticsOverview({ summary }: AnalyticsOverviewProps) {
  const period = periodLabel(summary.period);

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
          <p className="text-sm font-semibold text-muted-foreground">{period}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:space-y-6 md:px-6 md:py-6">
        <AnalyticsKpiGrid kpis={summary.kpis} />
        <AnalyticsCharts
          salesTimeline={summary.salesTimeline}
          topProducts={summary.topProducts}
        />
      </div>
    </div>
  );
}
