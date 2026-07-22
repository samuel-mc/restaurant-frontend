import { SuperAdminShell } from "@/components/superadmin/superadmin-shell";
import { getSuperAdminAccessToken } from "@/lib/superadmin-auth-server";

/**
 * Layout del backoffice global.
 * No usa x-tenant-slug: opera sobre el dominio principal.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSuperAdminAccessToken();
  if (!token) {
    return <>{children}</>;
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
