import type { Metadata } from "next";

type OrderTrackingPageProps = {
  params: Promise<{ tenant: string; uuid: string }>;
};

export const metadata: Metadata = {
  title: "Seguimiento del pedido",
  description: "Rastrea el estado de tu pedido en tiempo real.",
};

/**
 * Tracking del pedido en tiempo real (Módulo Pedidos).
 *
 * Server Component que renderiza el estado inicial del pedido (`uuid`) obtenido
 * por REST; un componente cliente hijo se suscribirá por WebSocket para
 * actualizar el estado (`PENDING` → `ACCEPTED` → `IN_KITCHEN` → `DELIVERED`).
 *
 * TODO: cargar el pedido por `uuid` y montar el suscriptor WebSocket del tenant.
 */
export default async function OrderTrackingPage({
  params,
}: OrderTrackingPageProps) {
  const { uuid } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <header className="-mx-4 mb-2 bg-linear-to-br from-amber-500 to-orange-600 px-6 pb-8 pt-10 text-white shadow-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-white/80">
          Seguimiento en tiempo real
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Tu pedido</h1>
        <p className="mt-2 break-all text-sm text-white/85">#{uuid}</p>
      </header>

      <section className="mt-8 rounded-2xl bg-black/5 p-6 text-center text-sm text-black/60 dark:bg-white/5 dark:text-white/60">
        Aquí se mostrará la línea de tiempo del pedido, actualizada por WebSocket.
      </section>
    </main>
  );
}
