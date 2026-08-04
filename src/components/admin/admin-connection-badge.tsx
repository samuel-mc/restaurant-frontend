"use client";

import { RefreshCw } from "lucide-react";
import type { KitchenConnectionState } from "@/hooks/useKitchenOrdersSubscription";

export function AdminConnectionBadge({
  state,
  compact = false,
  onSyncRequest,
  isSyncing = false,
}: {
  state: KitchenConnectionState;
  compact?: boolean;
  onSyncRequest?: () => void;
  isSyncing?: boolean;
}) {
  const fullLabel =
    state === "connected"
      ? "En vivo (WebSocket)"
      : state === "polling"
        ? "Sin WS · Respaldo HTTP activo"
        : state === "connecting"
          ? "Conectando…"
          : "Sin conexión · Reintentando";

  const label =
    compact && state === "connected"
      ? "Vivo"
      : compact && state === "polling"
        ? "HTTP"
        : compact && state === "disconnected"
          ? "Sin conexión"
          : compact && state === "connecting"
            ? "Conectando…"
            : fullLabel;

  const tone =
    state === "connected"
      ? "bg-live-muted text-live-ink"
      : state === "polling"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
        : state === "connecting"
          ? "bg-secondary text-muted-foreground"
          : "bg-warn-muted text-warn-ink";

  const dot =
    state === "connected"
      ? "bg-live"
      : state === "polling"
        ? "animate-pulse bg-amber-500"
        : state === "connecting"
          ? "animate-pulse bg-muted-foreground"
          : "animate-pulse bg-warn";

  const title =
    state === "connected"
      ? "Comandas transmitidas en tiempo real vía WebSockets"
      : state === "polling"
        ? "WebSocket desconectado. Sincronizando por polling HTTP automático de respaldo"
        : state === "disconnected"
          ? "Sin conexión con el servidor. Reintentando automáticamente"
          : "Estableciendo conexión en vivo";

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        role="status"
        aria-live="polite"
        aria-label={fullLabel}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full text-xs font-semibold ${
          compact ? "px-2.5" : "gap-2 px-3"
        } ${tone}`}
        title={title}
      >
        <span aria-hidden className={`size-2 rounded-full ${dot}`} />
        {label}
      </span>

      {onSyncRequest && (
        <button
          type="button"
          onClick={onSyncRequest}
          disabled={isSyncing}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
          title="Sincronizar comandas manualmente ahora"
        >
          <RefreshCw
            aria-hidden
            className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
          />
          <span className="sr-only">Sincronizar comandas</span>
        </button>
      )}
    </div>
  );
}

