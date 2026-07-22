"use client";

import type { SuperAdminMetrics } from "@/types/superadmin";

function formatMrr(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SuperAdminMetricsGrid({
  metrics,
}: {
  metrics: SuperAdminMetrics;
}) {
  const cards = [
    {
      label: "MRR estimado",
      value: formatMrr(metrics.estimatedMrr),
      hint: "Pro activos × $999",
    },
    {
      label: "Tenants activos",
      value: String(metrics.activeTenants),
      hint: `${metrics.totalTenants} totales`,
    },
    {
      label: "Churn rate",
      value: `${metrics.churnRate.toFixed(1)}%`,
      hint: `${metrics.suspendedTenants} suspendidos`,
    },
    {
      label: "Plan Pro",
      value: String(metrics.proTenants),
      hint: `${metrics.basicTenants} en Básico`,
    },
  ];

  const maxGrowth = Math.max(
    1,
    ...metrics.registrationGrowth.map((p) => p.count),
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 md:p-6">
        <header className="mb-6">
          <h2 className="text-sm font-semibold text-white">
            Crecimiento de registros
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Nuevos restaurantes por mes (últimos 6 meses)
          </p>
        </header>
        <div className="flex h-48 items-end gap-3 md:gap-4">
          {metrics.registrationGrowth.map((point) => {
            const height = Math.max(4, (point.count / maxGrowth) * 100);
            return (
              <div
                key={point.month}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <span className="text-[10px] font-medium tabular-nums text-zinc-400">
                  {point.count}
                </span>
                <div className="flex w-full items-end justify-center">
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-gradient-to-t from-emerald-600/80 to-emerald-400/90"
                    style={{ height: `${height}%` }}
                    title={`${point.month}: ${point.count}`}
                  />
                </div>
                <span className="truncate text-[10px] text-zinc-500">
                  {point.month.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
