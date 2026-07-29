export default function SuperAdminLoading() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-6 motion-safe:animate-pulse"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando SuperAdmin…</span>
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-72 max-w-full rounded bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-white/[0.06] bg-[#111113]"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="h-3 w-24 rounded bg-white/[0.06]" />
        </div>
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-40 max-w-full rounded bg-white/[0.06]" />
                <div className="h-2.5 w-24 rounded bg-white/[0.04]" />
              </div>
              <div className="hidden h-8 w-20 rounded-lg bg-white/[0.04] sm:block" />
              <div className="hidden h-8 w-24 rounded-lg bg-white/[0.04] md:block" />
              <div className="h-8 w-16 rounded-lg bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
