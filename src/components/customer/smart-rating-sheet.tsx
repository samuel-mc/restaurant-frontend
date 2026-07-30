"use client";

/**
 * Smart Rating: sheet de estrellas + formulario privado (1–3) + CTA Google (5).
 */

import { useEffect, useId, useState } from "react";
import { Star } from "lucide-react";
import { mapsExternalHref } from "@/lib/contact-links";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import {
  getFeedbackErrorMessage,
  markFeedbackSubmittedLocally,
  submitOrderFeedback,
} from "@/services/feedbackService";
import type {
  FeedbackOutcome,
  FeedbackReason,
  SubmitFeedbackResponse,
} from "@/types/api";

export type SmartRatingPhase = "stars" | "private" | "done";

interface SmartRatingSheetProps {
  open: boolean;
  orderUuid: string;
  tenantSlug: string;
  restaurantName: string;
  onClose: () => void;
  onCompleted: () => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const fieldClass = `${focusRing} min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground`;

const REASONS: { id: FeedbackReason; label: string }[] = [
  { id: "FOOD", label: "Comida" },
  { id: "SERVICE", label: "Servicio" },
  { id: "WAIT", label: "Tiempo de espera" },
  { id: "OTHER", label: "Otro" },
];

export function SmartRatingSheet({
  open,
  orderUuid,
  tenantSlug,
  restaurantName,
  onClose,
  onCompleted,
}: SmartRatingSheetProps) {
  const titleId = useId();
  const commentId = useId();
  const contactId = useId();
  const [phase, setPhase] = useState<SmartRatingPhase>("stars");
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitFeedbackResponse | null>(null);

  const panelRef = useModalFocusTrap({
    open,
    onEscape: () => {
      if (!busy) onClose();
    },
    escapeEnabled: !busy,
  });

  useEffect(() => {
    if (!open) return;
    setPhase("stars");
    setStars(0);
    setHovered(0);
    setReason(null);
    setComment("");
    setContact("");
    setBusy(false);
    setError(null);
    setResult(null);
  }, [open, orderUuid]);

  if (!open) return null;

  async function submit(payloadStars: number) {
    setBusy(true);
    setError(null);
    try {
      const response = await submitOrderFeedback(
        orderUuid,
        {
          stars: payloadStars,
          comment: payloadStars <= 3 ? comment.trim() : null,
          contact: payloadStars <= 3 ? contact.trim() || null : null,
          reason: payloadStars <= 3 ? reason : null,
        },
        tenantSlug,
      );
      markFeedbackSubmittedLocally(orderUuid);
      setResult(response);
      setPhase("done");
      onCompleted();
    } catch (err) {
      setError(getFeedbackErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleStarPick(value: number) {
    setStars(value);
    setError(null);
    if (value <= 3) {
      setPhase("private");
      return;
    }
    void submit(value);
  }

  function handlePrivateSubmit() {
    if (stars < 1 || stars > 3) return;
    if (comment.trim().length < 5) {
      setError("Cuéntanos qué pasó con al menos unas palabras.");
      return;
    }
    void submit(stars);
  }

  const mapsHref = mapsExternalHref(result?.googleMapsUrl);
  const outcome: FeedbackOutcome | null = result?.outcome ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        className="sheet-enter relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[1.5rem] border border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {restaurantName}
            </p>
            <h2
              id={titleId}
              className="mt-0.5 text-base font-bold tracking-tight"
            >
              {phase === "done"
                ? "¡Gracias!"
                : phase === "private"
                  ? "Cuéntanos qué mejorar"
                  : "¿Cómo estuvo tu experiencia?"}
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`${focusRing} inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground disabled:opacity-50`}
            aria-label="Cerrar"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="px-5 py-4">
          {phase === "stars" ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <p className="text-center text-sm text-muted-foreground">
                Tu opinión nos ayuda a mejorar. Toca una estrella.
              </p>
              <div
                className="flex items-center justify-center gap-1"
                role="group"
                aria-label="Calificación de 1 a 5 estrellas"
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = (hovered || stars) >= value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      aria-label={`${value} estrella${value === 1 ? "" : "s"}`}
                      onMouseEnter={() => setHovered(value)}
                      onMouseLeave={() => setHovered(0)}
                      onFocus={() => setHovered(value)}
                      onBlur={() => setHovered(0)}
                      onClick={() => handleStarPick(value)}
                      className={`${focusRing} inline-flex size-12 items-center justify-center rounded-xl transition-transform active:scale-95 disabled:opacity-50`}
                    >
                      <Star
                        className={`size-8 ${
                          active
                            ? "fill-amber-400 text-amber-500"
                            : "text-muted-foreground/50"
                        }`}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
              {busy ? (
                <p className="text-sm text-muted-foreground">Enviando…</p>
              ) : null}
            </div>
          ) : null}

          {phase === "private" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esto llega en privado al gerente — no se publica en Google.
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Motivo"
              >
                {REASONS.map((item) => {
                  const active = reason === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={busy}
                      aria-pressed={active}
                      onClick={() =>
                        setReason((prev) =>
                          prev === item.id ? null : item.id,
                        )
                      }
                      className={`${focusRing} min-h-10 rounded-xl px-3 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-foreground text-background"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <label htmlFor={commentId} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  ¿Qué pasó?
                </span>
                <textarea
                  id={commentId}
                  rows={4}
                  maxLength={1000}
                  disabled={busy}
                  placeholder="Ej. el plato llegó frío / esperamos mucho…"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className={`${fieldClass} min-h-[6rem] resize-none`}
                />
              </label>
              <label htmlFor={contactId} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  WhatsApp o teléfono{" "}
                  <span className="font-normal">(opcional)</span>
                </span>
                <input
                  id={contactId}
                  type="text"
                  inputMode="tel"
                  maxLength={120}
                  disabled={busy}
                  placeholder="Para contactarte si hace falta"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={handlePrivateSubmit}
                className={`${focusRing} flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--menu-accent)] px-4 text-sm font-semibold text-[var(--menu-accent-fg)] disabled:opacity-60`}
              >
                {busy ? "Enviando…" : "Enviar al gerente"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPhase("stars");
                  setStars(0);
                  setError(null);
                }}
                className={`${focusRing} w-full text-center text-xs font-medium text-muted-foreground underline underline-offset-2`}
              >
                Cambiar estrellas
              </button>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="space-y-4 py-1 text-center">
              <p className="text-sm text-muted-foreground">
                {result?.message ||
                  (outcome === "PRIVATE_COMPLAINT"
                    ? "El equipo lo revisará enseguida."
                    : "¡Gracias por tu opinión!")}
              </p>
              {outcome === "GOOGLE_REVIEW" && mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${focusRing} inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--menu-accent)] px-4 text-sm font-semibold text-[var(--menu-accent-fg)]`}
                >
                  Dejar reseña en Google
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className={`${focusRing} inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold text-foreground`}
              >
                Cerrar
              </button>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
