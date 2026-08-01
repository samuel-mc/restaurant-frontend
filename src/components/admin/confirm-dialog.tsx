"use client";

/**
 * Diálogo de confirmación reutilizable (overlay admin).
 */

import type { ReactNode } from "react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Bloque adicional bajo la descripción (p. ej. PIN a confirmar). */
  detail?: ReactNode;
  confirmLabel?: string;
  /** Texto del botón confirm mientras `busy` (p. ej. "Cobrando…"). */
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "danger" | "neutral" | "live";
  /** Error de API / acción visible dentro del diálogo (no bajo el overlay). */
  error?: string | null;
  /** Capa z-index del overlay (p. ej. sobre un drawer full-screen). */
  overlayClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function ConfirmDialog({
  open,
  title,
  description,
  detail = null,
  confirmLabel = "Confirmar",
  busyLabel = "Procesando…",
  cancelLabel = "Cancelar",
  busy = false,
  tone = "danger",
  error = null,
  overlayClassName = "z-[70]",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onCancel,
    escapeEnabled: !busy,
  });

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      : tone === "live"
        ? "bg-live text-live-foreground hover:brightness-110 disabled:opacity-50"
        : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50";

  const describedBy = [
    "confirm-dialog-desc",
    detail ? "confirm-dialog-detail" : null,
    error ? "confirm-dialog-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`fixed inset-0 ${overlayClassName} flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={describedBy}
        className="w-full max-w-md max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:rounded-2xl sm:pb-5"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-bold tracking-tight"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
        {detail ? (
          <div id="confirm-dialog-detail" className="mt-3">
            {detail}
          </div>
        ) : null}
        {error ? (
          <p
            id="confirm-dialog-error"
            role="alert"
            className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${confirmClass} ${focusRing}`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
