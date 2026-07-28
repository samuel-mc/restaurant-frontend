import { headers } from "next/headers";
import type { Metadata } from "next";
import { AdminLoginBrand } from "@/components/admin/admin-login-brand";
import { LoginForm } from "@/components/admin/login-form";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";

export const metadata: Metadata = {
  title: "Acceso · Cocina",
  description: "Entra a cocina y caja de tu restaurante.",
};

function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Login aislado por tenant (Módulo Admin).
 *
 * Server Component: lee `x-tenant-slug` (inyectada por `src/proxy.ts`) y
 * delega el formulario interactivo al Client Component.
 */
export default async function AdminLoginPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  const profile = tenantSlug
    ? await getPublicRestaurantProfileOrNull(tenantSlug)
    : null;
  const restaurantName =
    profile?.name?.trim() ||
    (tenantSlug ? prettifyTenant(tenantSlug) : "Panel de administración");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      {tenantSlug ? (
        <>
          <AdminLoginBrand
            restaurantName={restaurantName}
            logoUrl={profile?.logoUrl}
          />
          <LoginForm
            tenantSlug={tenantSlug}
            restaurantName={restaurantName}
            whatsapp={profile?.whatsapp}
          />
        </>
      ) : (
        <>
          <header className="flex flex-col gap-1.5 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-live-ink">
              PlatoListo
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Panel de administración
            </h1>
          </header>
          <section
            role="alert"
            className="rounded-2xl border border-warn/30 bg-warn-muted p-6 text-sm leading-relaxed text-warn-ink"
          >
            <p className="font-semibold">No encontramos tu restaurante</p>
            <p className="mt-2">
              Abre el panel desde el enlace de tu local (la dirección con el
              nombre de tu restaurante). Si no lo tienes, pídeselo a quien
              administra PlatoListo en tu negocio.
            </p>
            <p className="mt-3">
              <a
                href="mailto:hola@platolisto.com?subject=Acceso%20panel%20sin%20restaurante"
                className="rounded-sm font-semibold underline-offset-2 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-warn-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Contactar soporte PlatoListo
              </a>
            </p>
            {process.env.NODE_ENV === "development" ? (
              <p className="mt-3 text-xs opacity-90">
                Desarrollo:{" "}
                <code className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                  tu-local.localhost/admin/login
                </code>
              </p>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
