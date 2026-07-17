import { headers } from "next/headers";
import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Acceso · Panel",
  description: "Inicia sesión para administrar tu restaurante.",
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
  const restaurantLabel = tenantSlug
    ? prettifyTenant(tenantSlug)
    : "Panel de administración";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <header className="flex flex-col gap-1.5 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          {tenantSlug
            ? `Restaurante · ${tenantSlug}`
            : "Panel de administración"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
        <p className="text-sm text-foreground/60">
          Gestiona pedidos, menú y operación de tu local.
        </p>
      </header>

      {tenantSlug ? (
        <LoginForm
          tenantSlug={tenantSlug}
          restaurantLabel={restaurantLabel}
        />
      ) : (
        <section
          role="alert"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm leading-relaxed text-amber-950 dark:text-amber-100"
        >
          No pudimos identificar el restaurante. Abre el panel desde el
          subdominio de tu local (por ejemplo{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">
            mario.localhost/admin/login
          </code>
          ).
        </section>
      )}
    </main>
  );
}
