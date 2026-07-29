import { SuperAdminTenantsTable } from "@/components/superadmin/superadmin-tenants-table";
import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminTenantsServer } from "@/services/superadminQueries";
import { ApiError } from "@/services/apiClient";

export const metadata = {
  title: "SuperAdmin · Restaurantes | PlatoListo",
};

export default async function SuperAdminTenantsPage() {
  await requireSuperAdminSession();

  let tenants = null;
  let error: string | null = null;
  try {
    tenants = await getSuperAdminTenantsServer();
  } catch (err) {
    error =
      err instanceof ApiError
        ? err.message
        : "No se pudo cargar el directorio de restaurantes. Revisa la conexión o vuelve a iniciar sesión.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Restaurantes
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Plan, cobro, suspensión e ingreso al panel de cada local.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : tenants ? (
        <SuperAdminTenantsTable initialTenants={tenants} />
      ) : null}
    </div>
  );
}
