import { SuperAdminMetricsGrid } from "@/components/superadmin/superadmin-metrics";
import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminMetricsServer } from "@/services/superadminQueries";
import { ApiError } from "@/services/apiClient";

export const metadata = {
  title: "SuperAdmin · Dashboard | PlatoListo",
};

export default async function SuperAdminDashboardPage() {
  await requireSuperAdminSession();

  let metrics = null;
  let error: string | null = null;
  try {
    metrics = await getSuperAdminMetricsServer();
  } catch (err) {
    error =
      err instanceof ApiError
        ? err.message
        : "No se pudieron cargar las métricas globales.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Métricas globales
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Salud del SaaS: ingresos estimados, tenants y crecimiento.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : metrics ? (
        <SuperAdminMetricsGrid metrics={metrics} />
      ) : null}
    </div>
  );
}
