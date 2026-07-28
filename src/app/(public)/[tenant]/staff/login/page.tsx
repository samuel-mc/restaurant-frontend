import type { Metadata } from "next";
import { StaffPinLogin } from "@/components/staff/staff-pin-login";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import { getPublicActiveStaffOrEmpty } from "@/services/publicStaffQueries";

type StaffLoginPageProps = {
  params: Promise<{ tenant: string }>;
};

export async function generateMetadata({
  params,
}: StaffLoginPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const name = profile?.name?.trim() || prettifyTenantSlug(tenant);
  return {
    title: `Acceso equipo · ${name}`,
    description: `Selecciona tu usuario e ingresa el PIN para acceder al panel de ${name}.`,
  };
}

export default async function StaffLoginPage({ params }: StaffLoginPageProps) {
  const { tenant } = await params;
  const [profile, staff] = await Promise.all([
    getPublicRestaurantProfileOrNull(tenant),
    getPublicActiveStaffOrEmpty(tenant),
  ]);
  const restaurantName = profile?.name?.trim() || prettifyTenantSlug(tenant);

  return (
    <StaffPinLogin
      tenantSlug={tenant}
      restaurantName={restaurantName}
      initialStaff={staff}
    />
  );
}
