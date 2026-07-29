import { Suspense } from "react";
import Link from "next/link";
import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminCouponsServer } from "@/services/superadminQueries";
import { SuperAdminCouponsPanel } from "@/components/superadmin/superadmin-coupons-panel";
import { SuperAdminHelpPanel } from "@/components/superadmin/superadmin-help-panel";
import { ApiError } from "@/services/apiClient";

export const metadata = {
  title: "SuperAdmin · Cupones | PlatoListo",
};

export default async function SuperAdminCouponsPage() {
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
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Cupones
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Códigos para activar un plan al registrar un restaurante. Si el local
            ya existe, cambia el plan en Restaurantes.
          </p>
        </div>
        <SuperAdminHelpPanel topic="coupons" />
      </header>

      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
        >
          <p>{error}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/superadmin/coupons"
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
      ) : coupons ? (
        <Suspense
          fallback={
            <p className="text-sm text-zinc-400" aria-live="polite">
              Cargando cupones…
            </p>
          }
        >
          <SuperAdminCouponsPanel initialCoupons={coupons} />
        </Suspense>
      ) : null}
    </div>
  );
}
