"use client";

/**
 * Confirmación modal del SuperAdmin (canvas oscuro).
 * Portal a body + shell inert para aislar AT del fondo.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import {
  saAlertError,
  saField,
  saFocusOnSurface,
} from "@/components/superadmin/superadmin-ui";

interface SuperAdminConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  detail?: ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "danger" | "neutral";
  error?: string | null;
  /** Si se define, el usuario debe escribir este texto exacto para habilitar confirmar. */
  challenge?: string | null;
  challengeHint?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const focusRing = saFocusOnSurface;
const SHELL_ROOT_ID = "superadmin-root";

export function SuperAdminConfirmDialog({
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
  challenge = null,
  challengeHint,
  onConfirm,
  onCancel,
}: SuperAdminConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const detailId = useId();
  const errorId = useId();
  const challengeId = useId();
  const [typed, setTyped] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const panelRef = useModalFocusTrap({
    open,
    onEscape: onCancel,
    escapeEnabled: !busy,
  });

  // After focus-trap registration so cleanup removes inert *before* focus restore.
  useEffect(() => {
    if (!open) return;
    const shell = document.getElementById(SHELL_ROOT_ID);
    if (!shell) return;

    const previousInert = shell.inert;
    shell.inert = true;
    return () => {
      shell.inert = previousInert;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const challengeOk =
    challenge == null || challenge.trim() === "" || typed.trim() === challenge;
  const canConfirm = !busy && challengeOk;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-500 disabled:opacity-40"
      : "bg-[#047857] text-white hover:bg-[#065F46] disabled:opacity-40";

  const dialogRole = tone === "danger" ? "alertdialog" : "dialog";

  const describedBy = [
    descId,
    detail ? detailId : null,
    challenge ? challengeId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role={dialogRole}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="w-full max-w-md max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#111113] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] text-zinc-100 sm:rounded-2xl sm:pb-5"
      >
        <h2 id={titleId} className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-zinc-400">
          {description}
        </p>
        {detail ? (
          <div id={detailId} className="mt-3 text-sm text-zinc-300">
            {detail}
          </div>
        ) : null}
        {challenge ? (
          <label className="mt-4 block space-y-1.5" id={challengeId}>
            <span className="text-xs font-medium text-zinc-400">
              {challengeHint ?? (
                <>
                  Escribe{" "}
                  <span className="font-mono text-zinc-200">{challenge}</span>{" "}
                  para confirmar
                </>
              )}
            </span>
            <input
              data-testid="sa-confirm-challenge"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className={`${saField} font-mono ${focusRing}`}
              placeholder={challenge}
            />
          </label>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className={`mt-3 ${saAlertError}`}>
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50 ${focusRing}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="sa-confirm-submit"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${confirmClass} ${focusRing}`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
