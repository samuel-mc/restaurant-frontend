/**
 * El tenant ya activó el sitio (Pro / pago), pero la landing custom
 * aún no está registrada en el deploy.
 */

interface SiteInProgressProps {
  tenantSlug: string;
  restaurantName: string;
}

export function SiteInProgress({
  tenantSlug,
  restaurantName,
}: SiteInProgressProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl"
      >
        ✨
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
          {tenantSlug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{restaurantName}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-foreground/65">
          Tu website institucional a medida está en preparación. El menú
          digital ya funciona; la landing personalizada se publica cuando el
          equipo de PlatoListo la entregue.
        </p>
      </div>
      <a
        href="/menu"
        className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-amber-500/25 transition-transform active:scale-95"
      >
        Ir al menú digital
      </a>
    </main>
  );
}
