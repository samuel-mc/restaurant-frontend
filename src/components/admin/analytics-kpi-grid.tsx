import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { AnalyticsKpis } from "@/types/analytics";

interface AnalyticsKpiGridProps {
  kpis: AnalyticsKpis;
  /** Copy del delta vs periodo anterior (p. ej. "vs mes anterior"). */
  comparisonLabel?: string;
}

interface KpiCardConfig {
  id: string;
  label: string;
  value: string;
  changePercent: number;
  icon: typeof Banknote;
}

function ChangeBadge({
  changePercent,
  comparisonLabel,
}: {
  changePercent: number;
  comparisonLabel: string;
}) {
  const isPositive = changePercent >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const formatted = `${isPositive ? "+" : ""}${changePercent.toFixed(1)}%`;

  return (
    <p
      className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${
        isPositive ? "text-live-ink" : "text-destructive"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>
        {formatted}{" "}
        <span className="font-medium text-muted-foreground">
          {comparisonLabel}
        </span>
      </span>
    </p>
  );
}

export function AnalyticsKpiGrid({
  kpis,
  comparisonLabel = "vs periodo anterior",
}: AnalyticsKpiGridProps) {
  const cards: KpiCardConfig[] = [
    {
      id: "sales",
      label: "Facturación total",
      value: formatCurrency(kpis.totalSales),
      changePercent: kpis.salesChangePercent,
      icon: Banknote,
    },
    {
      id: "orders",
      label: "Pedidos totales",
      value: kpis.totalOrders.toLocaleString("es-MX"),
      changePercent: kpis.ordersChangePercent,
      icon: ShoppingBag,
    },
    {
      id: "ticket",
      label: "Ticket promedio",
      value: formatCurrency(kpis.averageTicket),
      changePercent: kpis.ticketChangePercent,
      icon: TrendingUp,
    },
  ];

  return (
    <section aria-label="Indicadores clave">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.id}
              className="rounded-2xl border border-border bg-card p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                    {card.value}
                  </p>
                </div>
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <ChangeBadge
                changePercent={card.changePercent}
                comparisonLabel={comparisonLabel}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
