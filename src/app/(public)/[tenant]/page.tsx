import type { Metadata } from "next";
import { RestaurantLanding } from "@/components/marketing/restaurant-landing";
import { SiteNotCreated } from "@/components/customer/site-not-created";
import { buildLandingBrand } from "@/lib/landing-brand";
import {
  getTenantSite,
  prettifyTenantSlug,
} from "@/lib/tenant-sites";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";

type TenantWebsitePageProps = {
  params: Promise<{ tenant: string }>;
};

export async function generateMetadata({
  params,
}: TenantWebsitePageProps): Promise<Metadata> {
  const { tenant } = await params;
  const site = getTenantSite(tenant);
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const name = profile?.name ?? site?.name ?? prettifyTenantSlug(tenant);

  return {
    title: site
      ? `${name} · Sitio oficial`
      : `${name} · Sitio no publicado`,
    description: site
      ? profile?.description?.trim() ||
        `Conoce ${name}: menú, reservaciones, ubicación y más.`
      : `El website de ${name} aún no ha sido creado.`,
  };
}

/**
 * Website institucional del restaurante (uno exclusivo por tenant).
 * Identidad y módulos vienen del perfil público del backend.
 */
export default async function TenantWebsitePage({
  params,
}: TenantWebsitePageProps) {
  const { tenant } = await params;
  const site = getTenantSite(tenant);
  const profile = await getPublicRestaurantProfileOrNull(tenant);

  if (!site) {
    return (
      <SiteNotCreated
        tenantSlug={tenant}
        restaurantName={profile?.name ?? prettifyTenantSlug(tenant)}
      />
    );
  }

  const brand = buildLandingBrand(site, profile);

  switch (site.templateId) {
    case "la-trattoria":
      return <RestaurantLanding brand={brand} />;
    default: {
      const _exhaustive: never = site.templateId;
      return _exhaustive;
    }
  }
}
