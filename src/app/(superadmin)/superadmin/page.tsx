import { SuperAdminMetricsGrid } from "@/components/superadmin/superadmin-metrics";
import { SuperAdminHelpPanel } from "@/components/superadmin/superadmin-help-panel";
import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminPanelMetricsServer } from "@/services/superadminQueries";
import { ApiError } from "@/services/apiClient";
import Link from "next/link";

export const metadata = {
  title: "SuperAdmin · Panel | PlatoListo",
};

export default async function SuperAdminDashboardPage() {
  await requireSuperAdminSession();

  let metrics = null;
  let error: string | null = null;
  try {
    metrics = await getSuperAdminPanelMetricsServer();
  } catch (err) {
    error =
      err instanceof ApiError
        ? err.message
        : "No se pudieron cargar las métricas. Revisa la conexión o vuelve a iniciar sesión.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Panel
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Empieza por lo que requiere acción: cobro, suspensión y cupones en
            riesgo. Las métricas debajo abren el directorio ya filtrado.
          </p>
        </div>
        <SuperAdminHelpPanel topic="panel" />
      </header>

      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          <p>{error}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/superadmin"
              className="inline-flex min-h-11 items-center font-semibold text-red-100 underline-offset-2 hover:underline"
            >
              Reintentar
            </Link>
            <Link
              href="/superadmin/login"
              className="inline-flex min-h-11 items-center font-semibold text-red-100/80 underline-offset-2 hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      ) : metrics ? (
        <SuperAdminMetricsGrid metrics={metrics} />
      ) : null}
    </div>
  );
}
