import { redirect } from "next/navigation";
import { SuperAdminLoginForm } from "@/components/superadmin/superadmin-login-form";
import { getSuperAdminAccessToken } from "@/lib/superadmin-auth-server";

export const metadata = {
  title: "SuperAdmin · Iniciar sesión | PlatoListo",
};

export default async function SuperAdminLoginPage() {
  const token = await getSuperAdminAccessToken();
  if (token) redirect("/superadmin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),_transparent_55%)]"
      />
      <SuperAdminLoginForm />
    </div>
  );
}
