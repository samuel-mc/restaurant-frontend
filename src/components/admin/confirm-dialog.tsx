"use client";

/**
 * Diálogo de confirmación reutilizable (overlay admin).
 */

import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Texto del botón confirm mientras `busy` (p. ej. "Cerrando…"). */
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "danger" | "neutral";
  /** Error de API / acción visible dentro del diálogo (no bajo el overlay). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  busyLabel = "Procesando…",
  cancelLabel = "Cancelar",
  busy = false,
  tone = "danger",
  error = null,
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
      : "bg-primary text-primary-foreground disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
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
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
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
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold ${confirmClass} ${focusRing}`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
