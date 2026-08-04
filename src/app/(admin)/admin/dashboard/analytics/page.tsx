import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AnalyticsDailyDashboard } from "@/components/admin/analytics-daily-dashboard";
import { getAdminAccessToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Métricas Diarias y Corte Z · Panel",
  description: "Cierre de caja, facturación acumulada del día y top platillos.",
};

export default async function AdminAnalyticsDailyPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Tenant no identificado</h1>
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

  return (
    <AnalyticsDailyDashboard
      tenantSlug={tenantSlug}
      restaurantName={tenantSlug}
    />
  );
}
