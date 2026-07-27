/**
 * Periodo de analíticas admin (API: week | month | year).
 */

import type { AnalyticsPeriod } from "@/types/analytics";

export const ANALYTICS_PERIODS: Array<{
  id: AnalyticsPeriod;
  label: string;
  comparisonLabel: string;
}> = [
  {
    id: "week",
    label: "Semana",
    comparisonLabel: "vs semana anterior",
  },
  {
    id: "month",
    label: "Mes",
    comparisonLabel: "vs mes anterior",
  },
  {
    id: "year",
    label: "Año",
    comparisonLabel: "vs año anterior",
  },
];

export function parseAnalyticsPeriod(
  raw: string | string[] | undefined,
): AnalyticsPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "week" || value === "year" || value === "month") return value;
  return "month";
}

export function analyticsPeriodMeta(period: AnalyticsPeriod) {
  return (
    ANALYTICS_PERIODS.find((entry) => entry.id === period) ??
    ANALYTICS_PERIODS[1]!
  );
}
