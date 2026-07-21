import type { Metadata } from "next";
import { RestaurantLanding } from "@/components/marketing/restaurant-landing";
import { SiteNotCreated } from "@/components/customer/site-not-created";
import { buildLandingBrand } from "@/lib/landing-brand";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";
import {
  getTenantSite,
  prettifyTenantSlug,
} from "@/lib/tenant-sites";
import { getMenuByTenant } from "@/services/menuService";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import type { Product } from "@/types/api";

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

  const title = site
    ? `${name} · Sitio oficial`
    : `${name} · Sitio no publicado`;
  const description = site
    ? profile?.description?.trim() ||
      `Conoce ${name}: menú, reservaciones, ubicación y más.`
    : `El website de ${name} aún no ha sido creado.`;

  return buildTenantPageMetadata({
    title,
    description,
    profile,
  });
}

async function loadCatalog(tenant: string): Promise<Product[]> {
  try {
    return await getMenuByTenant(tenant);
  } catch {
    return [];
  }
}

/**
 * Website institucional del restaurante (uno exclusivo por tenant).
 * Identidad, módulos y carta vienen del backend.
 */
export default async function TenantWebsitePage({
  params,
}: TenantWebsitePageProps) {
  const { tenant } = await params;
  const site = getTenantSite(tenant);
  const [profile, products] = await Promise.all([
    getPublicRestaurantProfileOrNull(tenant),
    loadCatalog(tenant),
  ]);

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
      return <RestaurantLanding brand={brand} products={products} />;
    default: {
      const _exhaustive: never = site.templateId;
      return _exhaustive;
    }
  }
}
