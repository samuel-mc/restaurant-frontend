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
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pt-4 md:space-y-5 md:px-6 md:pt-6">
      <AnalyticsKpiGrid
        kpis={summary.kpis}
        periodLabel={periodLabel(summary.period)}
      />
      <AnalyticsCharts
        salesTimeline={summary.salesTimeline}
        topProducts={summary.topProducts}
      />
    </div>
  );
}
