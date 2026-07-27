/**
 * Skeleton al cambiar de periodo en Métricas.
 */

export default function AnalyticsLoading() {
  return (
    <div className="font-jakarta-sans">
      <header className="border-b border-border px-4 py-5 md:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-secondary" />
          <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded-lg bg-secondary/80" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-6">
        <p className="text-sm font-medium text-muted-foreground">
          Cargando métricas…
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-36 animate-pulse rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}
