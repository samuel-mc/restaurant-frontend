import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso · Panel",
  description: "Inicia sesión para administrar tu restaurante.",
};

/**
 * Login aislado por tenant (Módulo Admin).
 *
 * Server Component: resuelve el tenant desde la cabecera `x-tenant-slug` que
 * inyecta `src/proxy.ts`. El formulario interactivo (validación + POST del
 * login y guardado del JWT) se implementará como componente cliente hijo.
 *
 * TODO: extraer un `<LoginForm />` ('use client') que llame al backend y
 * almacene el JWT (cookie HTTP-only preferida) antes de redirigir al dashboard.
 */
export default async function AdminLoginPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-foreground/50">
          {tenantSlug ? `Restaurante · ${tenantSlug}` : "Panel de administración"}
        </p>
        <h1 className="text-3xl font-bold">Iniciar sesión</h1>
      </header>

      <section className="rounded-xl border border-black/10 p-6 dark:border-white/15">
        <p className="text-sm text-foreground/60">
          Aquí vivirá el formulario de acceso (correo y contraseña) con
          autenticación JWT.
        </p>
      </section>
    </main>
  );
}
