import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AnalyticsOverview } from "@/components/admin/analytics-overview";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import { parseAnalyticsPeriod } from "@/lib/analytics-period";
import {
  emptyAnalyticsSummary,
  getAnalyticsSummary,
} from "@/services/adminAnalyticsQueries";
import { ApiError } from "@/services/apiClient";
import type { AnalyticsSummary } from "@/types/analytics";

export const metadata: Metadata = {
  title: "Métricas · Panel",
  description: "KPIs, facturación y top platillos del restaurante.",
};

/**
 * Métricas — pantalla inicial del panel.
 * Periodo vía `?period=week|month|year` (default month).
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Tenant no identificado
        </h1>
        <p className="text-sm text-muted-foreground">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  const query = await searchParams;
  const period = parseAnalyticsPeriod(query.period);

  let analytics: AnalyticsSummary = emptyAnalyticsSummary(period);
  let loadError = false;

  try {
    analytics = await getAnalyticsSummary(tenantSlug, period);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    loadError = true;
    analytics = emptyAnalyticsSummary(period);
  }

  return (
    <AnalyticsOverview
      summary={analytics}
      period={period}
      restaurantName={prettifyTenantSlug(tenantSlug)}
      loadError={loadError}
    />
  );
}
