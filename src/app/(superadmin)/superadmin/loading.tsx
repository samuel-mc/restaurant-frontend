export default function SuperAdminLoading() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-10 motion-safe:animate-pulse"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando SuperAdmin…</span>
      <div className="space-y-2">
        <div className="h-8 w-28 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-80 max-w-full rounded bg-white/[0.04]" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-white/[0.06]" />
        <div className="h-28 rounded-2xl border border-white/[0.06] bg-[#111113]" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-white/[0.06]" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-white/[0.06] bg-[#111113]"
            />
          ))}
        </div>
      </div>
      <div className="h-52 rounded-2xl border border-white/[0.06] bg-[#111113]" />
    </div>
  );
}
