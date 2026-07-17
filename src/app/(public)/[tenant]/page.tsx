import type { Metadata } from "next";
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
    title: `${name} · Menú`,
    description: `Menú digital de ${name}. Ordena desde tu mesa.`,
  };
}

export default async function TenantMenuPage({ params }: TenantMenuPageProps) {
  const { tenant } = await params;
  const restaurantName = prettifyTenant(tenant);

  let products: Product[] = [];
  let errorMessage: string | null = null;

  try {
    products = await getMenuByTenant(tenant);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      errorMessage = "No encontramos este restaurante. Verifica el enlace o el código QR.";
    } else {
      errorMessage = "No pudimos cargar el menú en este momento. Intenta de nuevo en unos segundos.";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <header className="-mx-4 mb-2 bg-linear-to-br from-amber-500 to-orange-600 px-6 pb-8 pt-10 text-white shadow-sm">
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

      {errorMessage ? (
        <div className="mt-8 rounded-2xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/40">
          {errorMessage}
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-black/5 p-6 text-center text-sm text-black/60 dark:bg-white/5 dark:text-white/60">
          Este restaurante aún no tiene platillos disponibles.
        </div>
      ) : (
        <MenuView products={products} />
      )}
    </main>
  );
}
