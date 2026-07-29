import { requireSuperAdminSession } from "@/lib/superadmin-session";
import { getSuperAdminCouponsServer } from "@/services/superadminQueries";
import { SuperAdminCouponsPanel } from "@/components/superadmin/superadmin-coupons-panel";

export const metadata = {
  title: "SuperAdmin · Billing | PlatoListo",
};

export default async function SuperAdminBillingPage() {
  await requireSuperAdminSession();
  const coupons = await getSuperAdminCouponsServer();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Billing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cupones y activación manual de planes. Los cambios de plan por tenant
          están en Tenants.
        </p>
      </header>

      <SuperAdminCouponsPanel initialCoupons={coupons} />
    </div>
  );
}
