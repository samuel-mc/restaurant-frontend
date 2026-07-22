import type { Metadata } from "next";
import { SiteInProgress } from "@/components/customer/site-in-progress";
import { SiteNotCreated } from "@/components/customer/site-not-created";
import { buildLandingBrand } from "@/lib/landing-brand";
import { getTenantLanding } from "@/lib/tenant-landings";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";
import {
  prettifyTenantSlug,
  resolveTenantSite,
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
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const site = resolveTenantSite(tenant, profile);
  const name = profile?.name ?? site?.name ?? prettifyTenantSlug(tenant);

  let title: string;
  let description: string;

  if (!site) {
    title = `${name} · Sitio no publicado`;
    description = `El website de ${name} aún no ha sido publicado.`;
  } else if (!site.hasCustomLanding) {
    title = `${name} · Sitio en preparación`;
    description = `El website a medida de ${name} está en preparación.`;
  } else {
    title = `${name} · Sitio oficial`;
    description =
      profile?.description?.trim() ||
      `Conoce ${name}: menú, reservaciones, ubicación y más.`;
  }

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
 * Website institucional: landing **custom por tenant** (fee de setup).
 * - No publicado → SiteNotCreated
 * - Publicado sin componente registrado → SiteInProgress
 * - Publicado + registro → landing dedicada
 */
export default async function TenantWebsitePage({
  params,
}: TenantWebsitePageProps) {
  const { tenant } = await params;
  const [profile, products] = await Promise.all([
    getPublicRestaurantProfileOrNull(tenant),
    loadCatalog(tenant),
  ]);
  const site = resolveTenantSite(tenant, profile);
  const restaurantName = profile?.name ?? prettifyTenantSlug(tenant);

  if (!site) {
    return (
      <SiteNotCreated tenantSlug={tenant} restaurantName={restaurantName} />
    );
  }

  const Landing = getTenantLanding(site.slug);
  if (!Landing) {
    return (
      <SiteInProgress tenantSlug={tenant} restaurantName={restaurantName} />
    );
  }

  const brand = buildLandingBrand(site, profile);
  return <Landing brand={brand} products={products} />;
}
