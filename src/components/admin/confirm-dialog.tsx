"use client";

/**
 * Diálogo de confirmación reutilizable (overlay admin).
 */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busy = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      : "bg-foreground text-background disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-neutral-900"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-extrabold tracking-tight"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm leading-relaxed text-black/60 dark:text-white/60"
        >
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-2xl px-4 py-2.5 text-sm font-bold text-black/60 hover:bg-black/5 disabled:opacity-50 dark:text-white/60 dark:hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-2.5 text-sm font-bold ${confirmClass}`}
          >
            {busy ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
