import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Configuración · Panel",
  description: "Configura la identidad de marca, horarios y módulos activos.",
};

/**
 * Configuración de identidad de marca, horarios y módulos (Módulo Admin).
 *
 * Server Component que resuelve el tenant desde `x-tenant-slug` y cargará la
 * configuración actual del restaurante. Los formularios de edición se
 * implementarán como componentes cliente.
 *
 * TODO: cargar los ajustes del tenant y montar los formularios de marca,
 * horarios y activación de módulos.
 */
export default async function AdminSettingsPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-foreground/50">
          {tenantSlug ? `Restaurante · ${tenantSlug}` : "Panel de administración"}
        </p>
        <h1 className="text-3xl font-bold">Configuración</h1>
      </header>

      <section className="rounded-xl border border-black/10 p-6 dark:border-white/15">
        <p className="text-sm text-foreground/60">
          Aquí se configurará la identidad de marca (logo, colores), horarios de
          atención y los módulos activos del restaurante.
        </p>
      </section>
    </main>
  );
}
