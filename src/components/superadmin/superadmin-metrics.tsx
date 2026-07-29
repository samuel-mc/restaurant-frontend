"use client";

import Link from "next/link";
import type { SuperAdminMetrics } from "@/types/superadmin";
import { saFocusOnSurface } from "@/components/superadmin/superadmin-ui";

function formatMrr(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function monthLabel(month: string): string {
  const parts = month.split("-");
  if (parts.length < 2) return month;
  return parts[1] ?? month;
}

export function SuperAdminMetricsGrid({
  metrics,
}: {
  metrics: SuperAdminMetrics;
}) {
  const needsAttention = metrics.suspendedTenants > 0;
  const cards = [
    {
      label: "Ingreso mensual estimado",
      value: formatMrr(metrics.estimatedMrr),
      hint: "Suma de restaurantes Pro activos × $999 MXN. No incluye Básico ni suspendidos.",
      emphasize: false,
    },
    {
      label: "Restaurantes activos",
      value: String(metrics.activeTenants),
      hint: `${metrics.totalTenants} registrados en total`,
      emphasize: false,
    },
    {
      label: "Tasa de baja",
      value: `${metrics.churnRate.toFixed(1)}%`,
      hint: `${metrics.suspendedTenants} suspendidos sobre el total registrado`,
      emphasize: needsAttention,
    },
    {
      label: "En plan Pro",
      value: String(metrics.proTenants),
      hint: `${metrics.basicTenants} en plan Básico`,
      emphasize: false,
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
    <div className="space-y-8">
      {needsAttention ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-100">
              {metrics.suspendedTenants} restaurante
              {metrics.suspendedTenants === 1 ? "" : "s"} suspendido
              {metrics.suspendedTenants === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-xs text-amber-100/70">
              Revisar cobro o reactivar desde el directorio.
            </p>
          </div>
          <Link
            href="/superadmin/tenants"
            className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/25 ${saFocusOnSurface}`}
          >
            Ir a Restaurantes
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-5 ${
              card.emphasize
                ? "border-amber-500/30 bg-amber-500/[0.07]"
                : "border-white/[0.06] bg-[#111113]"
            }`}
          >
            <p
              className={`text-xs font-medium ${
                card.emphasize ? "text-amber-200/80" : "text-zinc-500"
              }`}
            >
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">
              {card.value}
            </p>
            <p
              className={`mt-1 text-xs leading-relaxed ${
                card.emphasize ? "text-amber-100/60" : "text-zinc-500"
              }`}
            >
              {card.hint}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 md:p-6">
        <header className="mb-6">
          <h2 className="text-sm font-semibold text-white">
            Altas de restaurantes
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cuántos restaurantes nuevos se registraron cada mes (últimos 6).
          </p>
        </header>
        {metrics.registrationGrowth.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            Aún no hay altas mensuales para graficar.
          </p>
        ) : (
          <div
            className="flex h-48 items-end gap-3 md:gap-4"
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
                  <span className="truncate text-xs text-zinc-500">{label}</span>
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
