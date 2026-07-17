import type { Metadata } from "next";
import { RestaurantLanding } from "@/components/marketing/restaurant-landing";
import { SiteNotCreated } from "@/components/customer/site-not-created";
import {
  getTenantSite,
  prettifyTenantSlug,
} from "@/lib/tenant-sites";

type TenantWebsitePageProps = {
  params: Promise<{ tenant: string }>;
};

export async function generateMetadata({
  params,
}: TenantWebsitePageProps): Promise<Metadata> {
  const { tenant } = await params;
  const site = getTenantSite(tenant);
  const name = site?.name ?? prettifyTenantSlug(tenant);

  return {
    title: site
      ? `${name} · Sitio oficial`
      : `${name} · Sitio no publicado`,
    description: site
      ? `Conoce ${name}: menú, reservaciones, ubicación y más.`
      : `El website de ${name} aún no ha sido creado.`,
  };
}

/**
 * Website institucional del restaurante (uno exclusivo por tenant).
 *
 * - `la-trattoria` → sitio exclusivo La Trattoria (plantilla demo completa).
 * - Otros tenants → solo si tienen sitio registrado; si no, estado "bajo demanda".
 * Nunca se reutiliza el contenido de La Trattoria para otro restaurante.
 */
export default async function TenantWebsitePage({
  params,
}: TenantWebsitePageProps) {
  const { tenant } = await params;
  const site = getTenantSite(tenant);

  if (!site) {
    return (
      <SiteNotCreated
        tenantSlug={tenant}
        restaurantName={prettifyTenantSlug(tenant)}
      />
    );
  }

  switch (site.templateId) {
    case "la-trattoria":
      return (
        <RestaurantLanding
          brand={{
            name: site.name,
            tagline: site.tagline,
            slug: site.slug,
          }}
        />
      );
    default: {
      // Exhaustividad: si se agrega un templateId nuevo, TypeScript exige manejarlo.
      const _exhaustive: never = site.templateId;
      return _exhaustive;
    }
  }
}
