/**
 * Estado público cuando el tenant no existe o está suspendido (isActive=false).
 */

import { Lock } from "lucide-react";

interface TenantUnavailableProps {
  tenantSlug: string;
  restaurantName: string;
}

export function TenantUnavailable({
  tenantSlug,
  restaurantName,
}: TenantUnavailableProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Lock className="size-8 stroke-[1.5]" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
          {tenantSlug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{restaurantName}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-foreground/65">
          Este restaurante no está disponible en este momento. Si llegaste por
          un enlace o código QR, verifica que siga vigente o contacta al local.
        </p>
      </div>
    </main>
  );
}
