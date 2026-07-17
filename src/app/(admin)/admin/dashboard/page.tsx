export default function AdminDashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-foreground/50">
          Panel de administración
        </p>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Pedidos activos", "Ventas del día", "Platillos agotados"].map(
          (metric) => (
            <div
              key={metric}
              className="rounded-xl border border-black/10 p-5 dark:border-white/15"
            >
              <p className="text-sm text-foreground/60">{metric}</p>
              <p className="mt-2 text-2xl font-semibold">—</p>
            </div>
          )
        )}
      </section>
    </main>
  );
}
