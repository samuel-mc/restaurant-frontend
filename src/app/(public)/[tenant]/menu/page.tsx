import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { getMenuByTenant } from "@/services/menuService";
import { ApiError } from "@/services/apiClient";
import type { Product } from "@/types/api";
import { MenuView } from "@/components/customer/menu-view";

type TenantMenuPageProps = {
  params: Promise<{ tenant: string }>;
};

/** Convierte el slug del subdominio en un nombre legible ("la-parrilla" → "La Parrilla"). */
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
  const name = prettifyTenant(tenant);
  return {
    title: `${name} · Menú digital`,
    description: `Explora el menú de ${name} y arma tu pedido desde tu mesa.`,
  };
}

type MenuLoadResult =
  | { status: "ok"; products: Product[] }
  | { status: "empty" }
  | { status: "unavailable"; message: string };

/**
 * Carga el catálogo del tenant. Se aísla para mantener el Server Component limpio
 * y tipar explícitamente los estados de UI (ok / vacío / no disponible).
 */
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
 * Menú digital interactivo + carrito (Módulo Catálogo/Pedidos).
 *
 * Server Component: resuelve el tenant, carga el catálogo y delega la
 * interactividad (categorías, listado, carrito) a componentes cliente.
 */
export default async function TenantMenuPage({ params }: TenantMenuPageProps) {
  const { tenant } = await params;
  const restaurantName = prettifyTenant(tenant);
  const menu = await loadMenu(tenant);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-neutral-50 px-4 dark:bg-neutral-950">
      <header className="-mx-4 mb-1 bg-linear-to-br from-amber-500 to-orange-600 px-6 pb-8 pt-10 text-white shadow-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-white/80">
          Menú digital
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {restaurantName}
        </h1>
        <p className="mt-2 text-sm text-white/85">
          Explora nuestro menú y arma tu pedido desde tu mesa.
        </p>
      </header>

      {menu.status === "ok" ? (
        <MenuView products={menu.products} />
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

/** Estado vacío / error elegante, mobile-first. */
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
