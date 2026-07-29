"use client";

/**
 * Panel SuperAdmin — layout Operate:
 * 1) Atención ahora (hero)
 * 2) Métricas compactas con click-through
 * 3) Altas (contexto)
 */

import Link from "next/link";
import type { SuperAdminMetrics } from "@/types/superadmin";
import { saFocus, saFocusOnSurface } from "@/components/superadmin/superadmin-ui";

function formatMrr(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function monthLabel(month: string): string {
  const d = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return new Intl.DateTimeFormat("es-MX", { month: "short" }).format(d);
}

type MetricLink = {
  label: string;
  value: string;
  hint: string;
  href: string;
  emphasize?: boolean;
};

export function SuperAdminMetricsGrid({
  metrics,
}: {
  metrics: SuperAdminMetrics;
}) {
  const needsAttention = metrics.suspendedTenants > 0;

  const metricsRow: MetricLink[] = [
    {
      label: "Ingreso mensual estimado",
      value: formatMrr(metrics.estimatedMrr),
      hint: "Pro activos × $999 MXN",
      href: "/superadmin/tenants",
    },
    {
      label: "Restaurantes activos",
      value: String(metrics.activeTenants),
      hint: `${metrics.totalTenants} registrados`,
      href: "/superadmin/tenants?status=active",
    },
    {
      label: "Suspendidos",
      value: String(metrics.suspendedTenants),
      hint: `Tasa de baja ${metrics.churnRate.toFixed(1)}%`,
      href: "/superadmin/tenants?status=suspended",
      emphasize: needsAttention,
    },
    {
      label: "Plan Pro",
      value: String(metrics.proTenants),
      hint: `${metrics.basicTenants} en Básico`,
      href: "/superadmin/tenants",
    },
  ];

  const maxGrowth = Math.max(
    1,
    ...metrics.registrationGrowth.map((p) => p.count),
  );

  const growthSummary =
    metrics.registrationGrowth.length === 0
      ? "Sin datos de registros en los últimos meses."
      : `Registros nuevos por mes: ${metrics.registrationGrowth
          .map((p) => `${monthLabel(p.month)} ${p.count}`)
          .join(", ")}.`;

  return (
    <div className="space-y-10">
      <section aria-labelledby="panel-attention-heading" className="space-y-3">
        <h2
          id="panel-attention-heading"
          className="text-sm font-semibold text-white"
        >
          Atención ahora
        </h2>

        {needsAttention ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.09] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
            <div className="min-w-0 space-y-1">
              <p className="text-3xl font-semibold tracking-tight text-amber-50 tabular-nums sm:text-4xl">
                {metrics.suspendedTenants}
              </p>
              <p className="text-sm font-medium text-amber-100">
                restaurante
                {metrics.suspendedTenants === 1 ? "" : "s"} suspendido
                {metrics.suspendedTenants === 1 ? "" : "s"}
              </p>
              <p className="text-xs leading-relaxed text-amber-100/70">
                Revisar cobro o reactivar. El filtro Suspendidos ya queda
                aplicado en el directorio.
              </p>
            </div>
            <Link
              href="/superadmin/tenants?status=suspended"
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 ${saFocusOnSurface}`}
            >
              Ver suspendidos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-100">
                Sin restaurantes suspendidos
              </p>
              <p className="mt-1 text-xs text-emerald-100/65">
                El directorio está al corriente en estado operativo.
              </p>
            </div>
            <Link
              href="/superadmin/tenants"
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 ${saFocusOnSurface}`}
            >
              Ir a Restaurantes
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="panel-metrics-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="panel-metrics-heading"
            className="text-sm font-semibold text-white"
          >
            Resumen
          </h2>
          <p className="text-xs text-zinc-400">
            Selecciona una métrica para filtrar
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {metricsRow.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group block rounded-xl border px-4 py-3 transition hover:bg-white/[0.03] ${saFocus} ${
                card.emphasize
                  ? "border-amber-500/30 bg-amber-500/[0.06]"
                  : "border-white/[0.06] bg-[#111113]"
              }`}
            >
              <p
                className={`text-xs font-medium ${
                  card.emphasize
                    ? "text-amber-200/80"
                    : "text-zinc-400 group-hover:text-zinc-300"
                }`}
              >
                {card.label}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-white tabular-nums">
                {card.value}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  card.emphasize ? "text-amber-100/70" : "text-zinc-400"
                }`}
              >
                {card.hint}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="panel-growth-heading"
        className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 md:p-6"
      >
        <header className="mb-5">
          <h2
            id="panel-growth-heading"
            className="text-sm font-semibold text-white"
          >
            Altas de restaurantes
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Nuevos registros por mes (últimos 6).
          </p>
        </header>
        {metrics.registrationGrowth.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            Aún no hay altas mensuales para graficar.
          </p>
        ) : (
          <div
            className="flex h-40 items-end gap-3 md:h-44 md:gap-4"
            role="img"
            aria-label={growthSummary}
          >
            {metrics.registrationGrowth.map((point) => {
              const height = Math.max(4, (point.count / maxGrowth) * 100);
              const label = monthLabel(point.month);
              return (
                <div
                  key={point.month}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs font-medium tabular-nums text-zinc-400">
                    {point.count}
                  </span>
                  <div className="flex w-full items-end justify-center">
                    <div
                      className="w-full max-w-[48px] rounded-t-md bg-[#047857]"
                      style={{ height: `${height}%` }}
                      title={`${point.month}: ${point.count} altas`}
                    />
                  </div>
                  <span className="truncate text-xs text-zinc-400">{label}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="sr-only">{growthSummary}</p>
      </section>
    </div>
  );
}
