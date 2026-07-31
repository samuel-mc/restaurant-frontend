"use client";

/**
 * Inbox de Smart Rating: reclamos 1–3★ y evaluaciones abiertas.
 */

import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning, Star } from "lucide-react";
import {
  fetchFeedbackInbox,
  resolveFeedback,
} from "@/services/adminFeedbackService";
import { ApiError } from "@/services/apiClient";
import type { AdminFeedbackItem, FeedbackInboxStatus } from "@/types/api";
import { formatTableLabel } from "@/lib/table-session";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const REASON_LABEL: Record<string, string> = {
  FOOD: "Comida",
  SERVICE: "Servicio",
  WAIT: "Espera",
  OTHER: "Otro",
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FeedbackInbox({ tenantSlug }: { tenantSlug: string }) {
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [filter, setFilter] = useState<"OPEN" | "URGENT" | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status: FeedbackInboxStatus | "ALL" =
        filter === "ALL" ? "ALL" : "OPEN";
      const list = await fetchFeedbackInbox(tenantSlug, {
        status,
        urgentOnly: filter === "URGENT",
      });
      setItems(list);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No pudimos cargar el inbox.",
      );
    } finally {
      setLoading(false);
    }
  }, [filter, tenantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResolve(
    id: number,
    status: "RESOLVED" | "DISMISSED",
  ) {
    setBusyId(id);
    setError(null);
    try {
      await resolveFeedback(id, status, tenantSlug);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No pudimos actualizar el aviso.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-live-ink">
          Smart Rating
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Inbox de opiniones</h1>
        <p className="text-sm text-muted-foreground">
          Los 1–3★ llegan aquí en privado. Los 5★ se redirigen a Google Maps.
        </p>
      </header>

      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Filtro de inbox"
      >
        {(
          [
            { id: "OPEN", label: "Abiertos" },
            { id: "URGENT", label: "Urgentes" },
            { id: "ALL", label: "Todos" },
          ] as const
        ).map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`${focusRing} min-h-10 rounded-xl px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <MessageSquareWarning
            className="mx-auto size-8 text-muted-foreground/70"
            aria-hidden
          />
          <p className="mt-3 text-sm font-semibold">Sin avisos por ahora</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando un comensal califique bajo, aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border bg-card p-4 shadow-sm ${
                item.urgent && item.status === "OPEN"
                  ? "border-destructive/40"
                  : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.urgent && item.status === "OPEN" ? (
                      <span className="rounded-lg bg-destructive/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-destructive">
                        Urgente
                      </span>
                    ) : null}
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.tableNumber
                        ? formatTableLabel(item.tableNumber)
                        : "Sin mesa"}{" "}
                      · {formatWhen(item.createdAt)}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 flex items-center gap-0.5"
                    aria-label={`${item.stars} de 5 estrellas`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`size-4 ${
                          n <= item.stars
                            ? "fill-amber-400 text-amber-500"
                            : "text-muted-foreground/35"
                        }`}
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
                <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {item.status === "OPEN"
                    ? "Abierto"
                    : item.status === "RESOLVED"
                      ? "Resuelto"
                      : "Descartado"}
                </span>
              </div>

              {item.reason ? (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Motivo: {REASON_LABEL[item.reason] ?? item.reason}
                </p>
              ) : null}
              {item.comment ? (
                <p className="mt-2 text-sm leading-snug text-foreground">
                  {item.comment}
                </p>
              ) : null}
              {item.contact ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Contacto: {item.contact}
                </p>
              ) : null}

              {item.status === "OPEN" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void handleResolve(item.id, "RESOLVED")}
                    className={`${focusRing} min-h-10 rounded-xl bg-live px-3 text-xs font-bold text-white disabled:opacity-60`}
                  >
                    Marcar resuelto
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void handleResolve(item.id, "DISMISSED")}
                    className={`${focusRing} min-h-10 rounded-xl bg-secondary px-3 text-xs font-semibold text-foreground disabled:opacity-60`}
                  >
                    Descartar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
