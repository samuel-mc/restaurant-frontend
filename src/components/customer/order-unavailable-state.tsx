"use client";

/**
 * Estado vacío / error del tracking: recuperación accionable.
 * El encabezado de marca lo pinta la page (homologado al menú).
 * Harden: Pedir ayuda; Reintentar pendiente + feedback si sigue fallando.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { whatsappChatUrl } from "@/lib/contact-links";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const primaryBtn = `${focusRing} inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--menu-accent)] px-4 text-sm font-semibold text-[var(--menu-accent-fg)] disabled:pointer-events-none disabled:opacity-60`;

const secondaryBtn = `${focusRing} inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground`;

const tertiaryBtn = `${focusRing} inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary px-4 text-sm font-semibold text-foreground`;

function formatRetryClock(): string {
  return new Date().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderUnavailableState({
  title,
  description,
  canRetry = true,
  whatsapp = null,
  orderRef = null,
}: {
  title: string;
  description: string;
  /** False para 404 (reintentar no ayuda). */
  canRetry?: boolean;
  whatsapp?: string | null;
  /** Fragmento corto del UUID para ayuda (mesa / WhatsApp). */
  orderRef?: string | null;
}) {
  const router = useRouter();
  const [helpHint, setHelpHint] = useState(false);
  const [isRetrying, startRetry] = useTransition();
  const [retryOutcome, setRetryOutcome] = useState<string | null>(null);
  const [failedRetries, setFailedRetries] = useState(0);
  const wasRetryingRef = useRef(false);

  useEffect(() => {
    if (wasRetryingRef.current && !isRetrying) {
      // Seguimos montados ⇒ el refresh no resolvió el pedido.
      setFailedRetries((n) => n + 1);
      setRetryOutcome(
        `Sigue sin estar disponible · último intento ${formatRetryClock()}`,
      );
    }
    wasRetryingRef.current = isRetrying;
  }, [isRetrying]);

  const waUrl = useMemo(() => {
    const ref = orderRef?.trim();
    const text = ref
      ? `Hola, no puedo ver el seguimiento del pedido #${ref}. ¿Me ayudan?`
      : "Hola, no puedo ver el seguimiento de mi pedido. ¿Me ayudan?";
    return whatsappChatUrl(whatsapp, { text });
  }, [whatsapp, orderRef]);

  const helpControl = waUrl ? (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={canRetry ? secondaryBtn : primaryBtn}
    >
      Pedir ayuda por WhatsApp
    </a>
  ) : (
    <button
      type="button"
      onClick={() => setHelpHint(true)}
      className={canRetry ? secondaryBtn : primaryBtn}
    >
      Pedir ayuda al personal
    </button>
  );

  return (
    <section
      aria-live="polite"
      data-testid="order-unavailable"
      className="my-8 flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-sm"
    >
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--menu-accent-muted)] text-[var(--menu-accent)]"
      >
        <ClipboardList className="size-7 stroke-[1.5]" />
      </div>
      <h2
        data-testid="order-unavailable-title"
        className="text-lg font-bold text-foreground"
      >
        {title}
      </h2>
      <p className="max-w-xs break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {description}
      </p>
      <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
        {canRetry ? (
          <button
            type="button"
            disabled={isRetrying}
            aria-busy={isRetrying}
            onClick={() => {
              setRetryOutcome(null);
              startRetry(() => {
                router.refresh();
              });
            }}
            className={primaryBtn}
          >
            {isRetrying ? "Reintentando…" : "Reintentar"}
          </button>
        ) : null}
        {helpControl}
        <Link
          href="/menu"
          data-testid="order-unavailable-menu-link"
          className={canRetry || waUrl ? tertiaryBtn : secondaryBtn}
        >
          Ver menú
        </Link>
      </div>
      {retryOutcome ? (
        <p
          role="status"
          className="mt-1 max-w-xs text-sm leading-snug text-muted-foreground"
        >
          {retryOutcome}
          {failedRetries >= 2
            ? " Si sigue fallando, usa Pedir ayuda."
            : ""}
        </p>
      ) : null}
      {helpHint && !waUrl ? (
        <p
          role="status"
          className="mt-1 max-w-xs text-sm leading-snug text-muted-foreground"
        >
          Habla con el mesero o en caja
          {orderRef?.trim()
            ? ` y menciona el pedido #${orderRef.trim()}`
            : ""}
          .
        </p>
      ) : null}
    </section>
  );
}
