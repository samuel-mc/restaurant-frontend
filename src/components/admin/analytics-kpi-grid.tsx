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
  periodLabel?: string;
}

interface KpiCardConfig {
  id: string;
  label: string;
  value: string;
  changePercent: number;
  icon: typeof Banknote;
  accent: string;
  iconBg: string;
}

function ChangeBadge({ changePercent }: { changePercent: number }) {
  const isPositive = changePercent >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const formatted = `${isPositive ? "+" : ""}${changePercent.toFixed(1)}%`;

  return (
    <p
      className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>
        {formatted}{" "}
        <span className="font-medium text-black/45 dark:text-white/45">
          vs periodo anterior
        </span>
      </span>
    </p>
  );
}

export function AnalyticsKpiGrid({
  kpis,
  periodLabel = "Este mes",
}: AnalyticsKpiGridProps) {
  const cards: KpiCardConfig[] = [
    {
      id: "sales",
      label: "Facturación total",
      value: formatCurrency(kpis.totalSales),
      changePercent: kpis.salesChangePercent,
      icon: Banknote,
      accent: "from-emerald-500/10 to-transparent",
      iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
    {
      id: "orders",
      label: "Pedidos totales",
      value: kpis.totalOrders.toLocaleString("es-MX"),
      changePercent: kpis.ordersChangePercent,
      icon: ShoppingBag,
      accent: "from-sky-500/10 to-transparent",
      iconBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    },
    {
      id: "ticket",
      label: "Ticket promedio",
      value: formatCurrency(kpis.averageTicket),
      changePercent: kpis.ticketChangePercent,
      icon: TrendingUp,
      accent: "from-orange-500/10 to-transparent",
      iconBg: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    },
  ];

  return (
    <section aria-label="Indicadores clave" className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-black/45 dark:text-white/45">
            Analíticas
          </p>
          <h2 className="text-xl font-black tracking-tight md:text-2xl">
            Métricas de negocio
          </h2>
        </div>
        <p className="text-sm font-semibold text-black/50 dark:text-white/50">
          {periodLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.id}
              className={`relative overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br ${card.accent} bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:p-6`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black/50 dark:text-white/50">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight tabular-nums md:text-3xl">
                    {card.value}
                  </p>
                </div>
                <span
                  className={`inline-flex size-11 items-center justify-center rounded-2xl ${card.iconBg}`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
              </div>
              <ChangeBadge changePercent={card.changePercent} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
