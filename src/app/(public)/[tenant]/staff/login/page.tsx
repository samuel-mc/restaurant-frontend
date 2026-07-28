import type { Metadata } from "next";
import { StaffPinLogin } from "@/components/staff/staff-pin-login";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import { getPublicActiveStaffDirectory } from "@/services/publicStaffQueries";

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
    title: `Turno · ${name}`,
    description: `Elige tu nombre e ingresa tu PIN para entrar al turno de ${name}.`,
  };
}

export default async function StaffLoginPage({ params }: StaffLoginPageProps) {
  const { tenant } = await params;
  const [profile, directory] = await Promise.all([
    getPublicRestaurantProfileOrNull(tenant),
    getPublicActiveStaffDirectory(tenant),
  ]);
  const restaurantName = profile?.name?.trim() || prettifyTenantSlug(tenant);

  return (
    <StaffPinLogin
      tenantSlug={tenant}
      restaurantName={restaurantName}
      logoUrl={profile?.logoUrl}
      whatsapp={profile?.whatsapp}
      initialStaff={directory.staff}
      directoryLoadFailed={directory.loadFailed}
    />
  );
}
