"use client";

import { useId, useMemo, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type {
  AnalyticsSalesPoint,
  AnalyticsTopProduct,
} from "@/types/analytics";

const CHART_ORANGE = "#ea580c";
const CHART_EMERALD = "#059669";

const CHART_THEME = {
  light: {
    tick: "#525252",
    tickMuted: "#737373",
    grid: "rgba(0,0,0,0.08)",
  },
  dark: {
    tick: "#e5e5e5",
    tickMuted: "#a3a3a3",
    grid: "rgba(255,255,255,0.12)",
  },
} as const;

function subscribeDarkMode(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => onStoreChange();
  media.addEventListener("change", onChange);

  const root = document.documentElement;
  const observer = new MutationObserver(onChange);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });

  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function getDarkModeSnapshot(): boolean {
  return (
    document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function useChartTheme() {
  const isDark = useSyncExternalStore(
    subscribeDarkMode,
    getDarkModeSnapshot,
    () => false,
  );
  return isDark ? CHART_THEME.dark : CHART_THEME.light;
}

interface AnalyticsChartsProps {
  salesTimeline: AnalyticsSalesPoint[];
  topProducts: AnalyticsTopProduct[];
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function SalesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const amount = payload[0]?.value ?? 0;
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-neutral-900 shadow-lg dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-300">
        {label ? formatShortDate(label) : ""}
      </p>
      <p className="mt-0.5 text-sm font-black tabular-nums text-neutral-900 dark:text-white">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function ProductTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: AnalyticsTopProduct & { label: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-neutral-900 shadow-lg dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-300">
        {row.name}
      </p>
      <p className="mt-0.5 text-sm font-black tabular-nums text-neutral-900 dark:text-white">
        {formatCurrency(row.revenue)}
      </p>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {row.quantity} vendidos
      </p>
    </div>
  );
}

export function AnalyticsCharts({
  salesTimeline,
  topProducts,
}: AnalyticsChartsProps) {
  const gradientId = useId().replace(/:/g, "");
  const theme = useChartTheme();

  const timelineData = useMemo(
    () =>
      salesTimeline.map((point) => ({
        ...point,
        label: formatShortDate(point.date),
      })),
    [salesTimeline],
  );

  const topData = useMemo(() => {
    const sorted = [...topProducts].sort((a, b) => b.revenue - a.revenue);
    return sorted.map((product) => ({
      ...product,
      label:
        product.name.length > 22
          ? `${product.name.slice(0, 20)}…`
          : product.name,
    }));
  }, [topProducts]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
      <section
        aria-label="Tendencia de facturación"
        className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:p-5 lg:col-span-3"
      >
        <header className="mb-4 px-1">
          <h3 className="text-base font-black tracking-tight md:text-lg">
            Facturación reciente
          </h3>
          <p className="text-sm font-medium text-black/45 dark:text-white/45">
            Tendencia diaria (hasta 30 días del periodo)
          </p>
        </header>

        {timelineData.length === 0 ? (
          <EmptyState message="Aún no hay ventas en este periodo." />
        ) : (
          <div className="h-64 w-full md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_ORANGE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_ORANGE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11, fill: theme.tickMuted }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("es-MX", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                  tick={{ fontSize: 11, fill: theme.tickMuted }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={<SalesTooltip />}
                  cursor={{
                    stroke: CHART_ORANGE,
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={CHART_ORANGE}
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 5, strokeWidth: 0, fill: CHART_ORANGE }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section
        aria-label="Top platillos"
        className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:p-5 lg:col-span-2"
      >
        <header className="mb-4 px-1">
          <h3 className="text-base font-black tracking-tight md:text-lg">
            Top 5 platillos
          </h3>
          <p className="text-sm font-medium text-black/45 dark:text-white/45">
            Por recaudación
          </p>
        </header>

        {topData.length === 0 ? (
          <EmptyState message="Sin productos vendidos aún." />
        ) : (
          <div className="h-64 w-full md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topData}
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid stroke={theme.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("es-MX", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                  tick={{ fontSize: 11, fill: theme.tickMuted }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={96}
                  tick={{ fontSize: 11, fill: theme.tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ProductTooltip />}
                  cursor={{ fill: "rgba(5,150,105,0.12)" }}
                />
                <Bar
                  dataKey="revenue"
                  fill={CHART_EMERALD}
                  radius={[0, 8, 8, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-2xl bg-black/[0.03] px-4 text-center text-sm font-semibold text-black/40 dark:bg-white/[0.04] dark:text-white/40 md:h-72">
      {message}
    </div>
  );
}
