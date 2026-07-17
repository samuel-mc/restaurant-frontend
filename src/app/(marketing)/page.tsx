import { RegisterForm } from "@/components/marketing/RegisterForm";

/**
 * Landing global del SaaS PlatoListo (dominio principal sin subdominio).
 * Los websites institucionales de cada restaurante viven en su subdominio:
 * `(public)/[tenant]/page.tsx`.
 */
export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-center gap-6 text-center">
        <span className="rounded-full border border-black/10 px-4 py-1 text-sm font-medium text-foreground/70 dark:border-white/15">
          SaaS multi-tenant para restaurantes
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          PlatoListo
        </h1>
        <p className="max-w-2xl text-lg text-foreground/70">
          Cada restaurante tiene su propio website, menú digital por QR y un
          panel en tiempo real para la cocina. Todo en su subdominio.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="#registro"
            className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-transform active:scale-95"
          >
            Registrar restaurante
          </a>
          <a
            href="#registro"
            className="rounded-lg border border-black/10 px-6 py-3 font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Empezar gratis
          </a>
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl">
        <RegisterForm />
      </section>
    </main>
  );
}
