import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ClipboardList } from "lucide-react";
import { getMenuByTenant } from "@/services/menuService";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import { ApiError } from "@/services/apiClient";
import type { Product, RestaurantProfile } from "@/types/api";
import { MenuView } from "@/components/customer/menu-view";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";

type TenantMenuPageProps = {
  params: Promise<{ tenant: string }>;
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
      `Explora el menú de ${name} y arma tu pedido.`,
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
 * Menú digital interactivo + carrito.
 * Cabecera y modalidades de pedido según perfil público.
 */
export default async function TenantMenuPage({ params }: TenantMenuPageProps) {
  const { tenant } = await params;
  const [menu, profile] = await Promise.all([
    loadMenu(tenant),
    getPublicRestaurantProfileOrNull(tenant),
  ]);

  const restaurantName = profile?.name ?? prettifyTenant(tenant);
  const headerStyle = headerStyleFromProfile(profile);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-neutral-50 px-4 dark:bg-neutral-950">
      <header
        className="-mx-4 mb-1 px-6 pb-8 pt-10 text-white shadow-sm"
        style={headerStyle}
      >
        <div className="flex items-center gap-3">
          {profile?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt=""
              className="size-12 rounded-2xl object-cover ring-2 ring-white/30"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-white/80">
              Menú digital
            </p>
            <h1 className="mt-1 truncate text-3xl font-extrabold tracking-tight">
              {restaurantName}
            </h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/85">
          {menuSubtitle(profile)}
        </p>
      </header>

      {menu.status === "ok" ? (
        <MenuView
          products={menu.products}
          tenantSlug={tenant}
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
    </main>
  );
}

function headerStyleFromProfile(
  profile: RestaurantProfile | null,
): CSSProperties {
  const from = profile?.primaryColor || "#f59e0b";
  const to = profile?.secondaryColor || "#ea580c";
  return {
    backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
  };
}

function menuSubtitle(profile: RestaurantProfile | null): string {
  const bits: string[] = [];
  if (profile?.hasPickup) bits.push("para llevar");
  if (profile?.hasDelivery) bits.push("delivery");
  if (bits.length === 0) return "Arma tu pedido desde tu mesa.";
  return `Pide en mesa, ${bits.join(" o ")}.`;
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
      className="my-8 flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
    >
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        <ClipboardList className="size-7 stroke-[1.5]" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-black/55 dark:text-white/55">
        {description}
      </p>
    </section>
  );
}
