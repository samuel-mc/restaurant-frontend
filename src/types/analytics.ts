/**
 * Resumen de analíticas de negocio (admin).
 */

export type AnalyticsPeriod = "week" | "month" | "year";

export interface AnalyticsKpis {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  salesChangePercent: number;
  ordersChangePercent: number;
  ticketChangePercent: number;
}

export interface AnalyticsSalesPoint {
  /** ISO date `yyyy-MM-dd`. */
  date: string;
  amount: number;
}

export interface AnalyticsTopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface AnalyticsSummary {
  kpis: AnalyticsKpis;
  salesTimeline: AnalyticsSalesPoint[];
  topProducts: AnalyticsTopProduct[];
  period: AnalyticsPeriod | string;
}

/** Payload crudo del backend (Jackson puede emitir números como number). */
export interface AnalyticsSummaryResponse {
  kpis: {
    totalSales: number | string;
    totalOrders: number;
    averageTicket: number | string;
    salesChangePercent?: number | null;
    ordersChangePercent?: number | null;
    ticketChangePercent?: number | null;
  };
  salesTimeline: Array<{
    date: string;
    amount: number | string;
  }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number | string;
  }>;
  period: string;
}
