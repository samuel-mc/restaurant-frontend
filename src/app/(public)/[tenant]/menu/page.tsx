import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { getMenuByTenant } from "@/services/menuService";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import { ApiError } from "@/services/apiClient";
import type { Product, RestaurantProfile } from "@/types/api";
import { MenuView } from "@/components/customer/menu-view";
import { CustomerBrandHeader } from "@/components/customer/customer-brand-header";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";
import { brandFromProfile } from "@/lib/menu-brand";

type TenantMenuPageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ m?: string | string[] }>;
};

function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: TenantMenuPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const name = profile?.name ?? prettifyTenant(tenant);
  return buildTenantPageMetadata({
    title: `${name} · Menú digital`,
    description:
      profile?.description?.trim() ||
      (profile?.orderingEnabled === false
        ? `Consulta el menú de ${name}.`
        : `Explora el menú de ${name} y arma tu pedido.`),
    profile,
  });
}

type MenuLoadResult =
  | { status: "ok"; products: Product[] }
  | { status: "empty" }
  | { status: "unavailable"; message: string };

async function loadMenu(tenant: string): Promise<MenuLoadResult> {
  try {
    const products = await getMenuByTenant(tenant);
    if (products.length === 0) return { status: "empty" };
    return { status: "ok", products };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        status: "unavailable",
        message:
          "No encontramos este restaurante. Verifica el enlace o el código QR.",
      };
    }
    return {
      status: "unavailable",
      message:
        "No pudimos cargar el menú en este momento. Intenta de nuevo en unos segundos.",
    };
  }
}

/**
 * Menú digital interactivo + carrito (flujo pedir unificado).
 * Cabecera y modalidades según perfil público.
 */
export default async function TenantMenuPage({
  params,
  searchParams,
}: TenantMenuPageProps) {
  const { tenant } = await params;
  const query = await searchParams;
  const rawM = query.m;
  const tableFromQuery =
    typeof rawM === "string"
      ? rawM
      : Array.isArray(rawM)
        ? rawM[0]
        : null;

  const [menu, profile] = await Promise.all([
    loadMenu(tenant),
    getPublicRestaurantProfileOrNull(tenant),
  ]);

  const restaurantName = profile?.name ?? prettifyTenant(tenant);
  const brand = brandFromProfile(profile);
  const hasBrandFill = Boolean(brand.accent);
  const supportLine = headerSupport(profile);

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[var(--menu-accent-wash,var(--background))] font-jakarta-sans text-foreground"
      style={brand.style}
    >
      <CustomerBrandHeader
        restaurantName={restaurantName}
        logoUrl={profile?.logoUrl}
        supportLine={supportLine}
        hasBrandFill={hasBrandFill}
      />

      <div className="flex flex-1 flex-col px-4">
        {menu.status === "ok" ? (
          <MenuView
            products={menu.products}
            tenantSlug={tenant}
            tableFromQuery={tableFromQuery}
            orderingEnabled={profile?.orderingEnabled !== false}
            modules={{
              hasDelivery: profile?.hasDelivery ?? false,
              hasPickup: profile?.hasPickup ?? true,
            }}
          />
        ) : (
          <MenuUnavailableState
            title="Menú no disponible"
            description={
              menu.status === "empty"
                ? "Este restaurante aún no tiene platillos publicados. Vuelve pronto."
                : menu.message
            }
          />
        )}
      </div>
    </main>
  );
}

function headerSupport(profile: RestaurantProfile | null): string | null {
  if (profile?.orderingEnabled === false) {
    return "Solo consulta · pedidos desactivados";
  }
  const description = profile?.description?.trim();
  if (description) return description;
  return null;
}

function MenuUnavailableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section
      aria-live="polite"
      className="my-10 flex flex-col items-center gap-3 px-2 py-12 text-center"
    >
      <div
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <ClipboardList className="size-7 stroke-[1.5]" />
      </div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
