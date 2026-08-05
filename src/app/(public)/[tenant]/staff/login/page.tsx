import type { Metadata } from "next";
import { StaffPinLogin } from "@/components/staff/staff-pin-login";
import { TenantUnavailable } from "@/components/customer/tenant-unavailable";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";
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
  if (!profile) {
    return {
      title: `${name} · No disponible`,
      description: `El restaurante ${name} no está disponible en este momento.`,
    };
  }
  return buildTenantPageMetadata({
    title: `Turno · ${name}`,
    description: `Elige tu nombre e ingresa tu PIN para entrar al turno de ${name}.`,
    profile,
  });
}

export default async function StaffLoginPage({ params }: StaffLoginPageProps) {
  const { tenant } = await params;
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const restaurantName = profile?.name?.trim() || prettifyTenantSlug(tenant);

  if (!profile) {
    return (
      <TenantUnavailable tenantSlug={tenant} restaurantName={restaurantName} />
    );
  }

  const directory = await getPublicActiveStaffDirectory(tenant);

  return (
    <StaffPinLogin
      tenantSlug={tenant}
      restaurantName={restaurantName}
      logoUrl={profile.logoUrl}
      whatsapp={profile.whatsapp}
      initialStaff={directory.staff}
      directoryLoadFailed={directory.loadFailed}
    />
  );
}
