import { SuperAdminMetricsGrid } from "@/components/superadmin/superadmin-metrics";
import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminMetricsServer } from "@/services/superadminQueries";
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
    metrics = await getSuperAdminMetricsServer();
  } catch (err) {
    error =
      err instanceof ApiError
        ? err.message
        : "No se pudieron cargar las métricas. Revisa la conexión o vuelve a iniciar sesión.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Panel
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Empieza por lo que requiere acción. Las métricas debajo abren el
          directorio ya filtrado.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          <p>{error}</p>
          <Link
            href="/superadmin/login"
            className="inline-flex min-h-11 items-center font-semibold text-red-100 underline-offset-2 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      ) : metrics ? (
        <SuperAdminMetricsGrid metrics={metrics} />
      ) : null}
    </div>
  );
}
