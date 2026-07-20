import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AnalyticsOverview } from "@/components/admin/analytics-overview";
import { getAdminAccessToken } from "@/lib/auth-server";
import {
  emptyAnalyticsSummary,
  getAnalyticsSummary,
} from "@/services/adminAnalyticsQueries";
import { ApiError } from "@/services/apiClient";
import type { AnalyticsSummary } from "@/types/analytics";

export const metadata: Metadata = {
  title: "Analíticas · Panel",
  description: "KPIs, facturación y top platillos del restaurante.",
};

/**
 * Módulo Analíticas — pantalla inicial del dashboard.
 */
export default async function AdminAnalyticsPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold">Tenant no identificado</h1>
        <p className="text-sm text-foreground/60">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  let analytics: AnalyticsSummary = emptyAnalyticsSummary("month");

  try {
    analytics = await getAnalyticsSummary(tenantSlug, "month");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    analytics = emptyAnalyticsSummary("month");
  }

  return (
    <div className="pb-8">
      <AnalyticsOverview summary={analytics} />
    </div>
  );
}
