import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminCouponsServer } from "@/services/superadminQueries";
import { SuperAdminCouponsPanel } from "@/components/superadmin/superadmin-coupons-panel";
import { ApiError } from "@/services/apiClient";

export const metadata = {
  title: "SuperAdmin · Cupones | PlatoListo",
};

export default async function SuperAdminBillingPage() {
  await requireSuperAdminSession();

  let coupons = null;
  let error: string | null = null;
  try {
    coupons = await getSuperAdminCouponsServer();
  } catch (err) {
    error =
      err instanceof ApiError
        ? err.message
        : "No se pudo cargar la lista de cupones. Revisa la conexión o vuelve a iniciar sesión.";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Cupones
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Códigos para activar planes al registrar un restaurante. Para cambiar
          el plan de uno ya existente, ve a Restaurantes.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : coupons ? (
        <SuperAdminCouponsPanel initialCoupons={coupons} />
      ) : null}
    </div>
  );
}
