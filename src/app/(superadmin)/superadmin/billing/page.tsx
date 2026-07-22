import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const metadata = {
  title: "SuperAdmin · Billing | PlatoListo",
};

export default async function SuperAdminBillingPage() {
  await requireSuperAdminSession();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Facturación y suscripciones globales (próximamente).
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-white/10 bg-[#111113] px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-300">
          Módulo de billing en construcción
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Aquí verás MRR detallado, facturas Stripe y estados de cobro por
          tenant.
        </p>
      </div>
    </div>
  );
}
