"use client";

import type { KitchenConnectionState } from "@/hooks/useKitchenOrdersSubscription";

export function AdminConnectionBadge({
  state,
  compact = false,
}: {
  state: KitchenConnectionState;
  compact?: boolean;
}) {
  const fullLabel =
    state === "connected"
      ? "En vivo"
      : state === "connecting"
        ? "Conectando…"
        : "Sin conexión · reintentando…";
  const label =
    compact && state === "connected"
      ? "Vivo"
      : compact && state === "disconnected"
        ? "Sin conexión"
        : compact && state === "connecting"
          ? "Conectando…"
          : fullLabel;

  const tone =
    state === "connected"
      ? "bg-live-muted text-live-ink"
      : state === "connecting"
        ? "bg-secondary text-muted-foreground"
        : "bg-warn-muted text-warn-ink";

  const dot =
    state === "connected"
      ? "bg-live"
      : state === "connecting"
        ? "animate-pulse bg-muted-foreground"
        : "animate-pulse bg-warn";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={fullLabel}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full text-xs font-semibold ${
        compact ? "px-2.5" : "gap-2 px-3"
      } ${tone}`}
      title={
        state === "connected"
          ? "Comandas en tiempo real"
          : state === "disconnected"
            ? "Mutaciones bloqueadas hasta reconectar"
            : "Estableciendo conexión en vivo"
      }
    >
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
