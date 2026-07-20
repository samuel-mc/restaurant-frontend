/**
 * Consultas admin de analíticas (solo servidor).
 */

import "server-only";

import { getAdminAuthHeaders } from "@/lib/auth-server";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiClient, ApiError } from "@/services/apiClient";
import type {
  AnalyticsPeriod,
  AnalyticsSummary,
  AnalyticsSummaryResponse,
} from "@/types/analytics";

const TENANT_HEADER = "X-Tenant";
const ANALYTICS_SUMMARY_PATH = "/api/v1/admin/analytics/summary";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapSummary(dto: AnalyticsSummaryResponse): AnalyticsSummary {
  return {
    period: dto.period,
    kpis: {
      totalSales: toNumber(dto.kpis.totalSales),
      totalOrders: dto.kpis.totalOrders ?? 0,
      averageTicket: toNumber(dto.kpis.averageTicket),
      salesChangePercent: toNumber(dto.kpis.salesChangePercent),
      ordersChangePercent: toNumber(dto.kpis.ordersChangePercent),
      ticketChangePercent: toNumber(dto.kpis.ticketChangePercent),
    },
    salesTimeline: (dto.salesTimeline ?? []).map((point) => ({
      date: point.date,
      amount: toNumber(point.amount),
    })),
    topProducts: (dto.topProducts ?? []).map((product) => ({
      name: product.name,
      quantity: product.quantity ?? 0,
      revenue: toNumber(product.revenue),
    })),
  };
}

export function emptyAnalyticsSummary(
  period: AnalyticsPeriod = "month",
): AnalyticsSummary {
  return {
    period,
    kpis: {
      totalSales: 0,
      totalOrders: 0,
      averageTicket: 0,
      salesChangePercent: 0,
      ordersChangePercent: 0,
      ticketChangePercent: 0,
    },
    salesTimeline: [],
    topProducts: [],
  };
}

/**
 * Resumen de KPIs, timeline de ventas y top productos.
 */
export async function getAnalyticsSummary(
  tenantSlug: string,
  period: AnalyticsPeriod = "month",
): Promise<AnalyticsSummary> {
  const slug = resolveTenantSlug(tenantSlug);
  const authHeaders = await getAdminAuthHeaders();

  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url: ANALYTICS_SUMMARY_PATH,
    });
  }

  const dto = await apiClient.get<AnalyticsSummaryResponse>(
    `${ANALYTICS_SUMMARY_PATH}?period=${encodeURIComponent(period)}`,
    {
      headers: {
        ...authHeaders,
        [TENANT_HEADER]: slug,
      },
      cache: "no-store",
    },
  );

  return mapSummary(dto);
}
