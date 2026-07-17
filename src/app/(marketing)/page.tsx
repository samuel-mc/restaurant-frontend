import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-full border border-black/10 px-4 py-1 text-sm font-medium text-foreground/70 dark:border-white/15">
          SaaS multi-tenant para restaurantes
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          PlatoListo
        </h1>
        <p className="max-w-xl text-lg text-foreground/70">
          Menú digital por QR para tus comensales y un panel en tiempo real para
          tu cocina. Cada restaurante, en su propio subdominio.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/admin/dashboard"
          className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-transform active:scale-95"
        >
          Ir al panel
        </Link>
        <a
          href="#"
          className="rounded-lg border border-black/10 px-6 py-3 font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Solicitar demo
        </a>
      </div>
    </main>
  );
}
