import type { Metadata } from "next";

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

/**
 * Menú digital interactivo + carrito (Módulo Catálogo/Pedidos).
 *
 * Server Component: obtendrá el catálogo del backend por tenant y delegará la
 * interactividad (agregar al carrito, stepper, bottom-sheet) a componentes
 * cliente ya existentes en `src/components/customer/`.
 *
 * TODO: cargar el catálogo con `getMenuByTenant(tenant)` y renderizar `MenuView`.
 */
export default async function TenantMenuPage({ params }: TenantMenuPageProps) {
  const { tenant } = await params;
  const restaurantName = prettifyTenant(tenant);

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
          Catálogo y carrito de pedidos (en construcción).
        </p>
      </header>

      <section className="mt-8 rounded-2xl bg-black/5 p-6 text-center text-sm text-black/60 dark:bg-white/5 dark:text-white/60">
        Aquí vivirá el menú interactivo con filtrado por categorías y el carrito.
      </section>
    </main>
  );
}
