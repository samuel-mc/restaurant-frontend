import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestor de menú · Panel",
  description: "Administra categorías, platillos, precios y stock.",
};

/**
 * Gestor de categorías, precios y stock rápido (Módulo Admin).
 *
 * Server Component que resuelve el tenant desde `x-tenant-slug` y cargará el
 * catálogo administrable del backend. Las mutaciones (ABM de platillos,
 * activar/agotar, precios) vivirán en componentes cliente con actualización
 * optimista.
 *
 * TODO: listar categorías y platillos del tenant y montar los controles de ABM.
 */
export default async function AdminMenuManagementPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-foreground/50">
          {tenantSlug ? `Restaurante · ${tenantSlug}` : "Panel de administración"}
        </p>
        <h1 className="text-3xl font-bold">Gestor de menú</h1>
      </header>

      <section className="rounded-xl border border-black/10 p-6 dark:border-white/15">
        <p className="text-sm text-foreground/60">
          Aquí se administrarán categorías, platillos, precios y disponibilidad
          (stock rápido).
        </p>
      </section>
    </main>
  );
}
