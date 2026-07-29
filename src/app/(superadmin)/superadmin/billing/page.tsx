import { redirect } from "next/navigation";

/** Ruta legacy: la pantalla es Cupones. */
export default function SuperAdminBillingRedirectPage() {
  redirect("/superadmin/coupons");
}
