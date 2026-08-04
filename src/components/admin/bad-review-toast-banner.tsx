"use client";

import { useState } from "react";
import { AlertOctagon, CheckCircle2, ShieldAlert, Star, X } from "lucide-react";
import { useAdminAlertsSubscription } from "@/hooks/useAdminAlertsSubscription";
import type { CriticalFeedbackAlertEvent } from "@/types/api";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface BadReviewToastBannerProps {
  tenantSlug: string;
  managerName?: string;
  onAttendTable?: (alert: CriticalFeedbackAlertEvent) => void;
}

export function BadReviewToastBanner({
  tenantSlug,
  managerName = "Manager",
  onAttendTable,
}: BadReviewToastBannerProps) {
  const [activeAlert, setActiveAlert] = useState<CriticalFeedbackAlertEvent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useAdminAlertsSubscription({
    tenantSlug,
    onCriticalAlert: (event) => {
      setActiveAlert(event);
    },
  });

  function handleAttend() {
    if (!activeAlert) return;
    const alertCopy = { ...activeAlert };
    const msg = `Atendiendo por ${managerName} en ${alertCopy.tableNumber}`;
    setToastMessage(msg);
    if (onAttendTable) {
      onAttendTable(alertCopy);
    }
    setActiveAlert(null);
    setTimeout(() => setToastMessage(null), 5000);
  }

  function handleDismiss() {
    setActiveAlert(null);
  }

  if (!activeAlert && !toastMessage) return null;

  return (
    <div
      data-testid="bad-review-banner-container"
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl transition-all duration-300"
    >
      {activeAlert ? (
        <div
          data-testid="bad-review-toast-banner"
          role="alert"
          aria-live="assertive"
          className="relative overflow-hidden rounded-2xl border-2 border-rose-500 bg-rose-950/95 p-4 text-rose-50 shadow-2xl backdrop-blur-md animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-rose-600/30 p-2 text-rose-300">
                <ShieldAlert className="size-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-rose-200">
                  🚨 ALERTA: MALA EXPERIENCIA EN {activeAlert.tableNumber.toUpperCase()}
                </h3>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="text-xs font-semibold text-rose-300">
                    Rating: {activeAlert.stars}★ / 5★
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`size-3.5 ${
                          n <= activeAlert.stars
                            ? "fill-rose-400 text-rose-400"
                            : "text-rose-900"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Descartar Alerta"
              className={`${focusRing} rounded-lg p-1 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100`}
            >
              <X className="size-5" />
            </button>
          </div>

          {activeAlert.tags && activeAlert.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeAlert.tags.map((tag, i) => (
                <span
                  key={i}
                  className="rounded-md border border-rose-500/40 bg-rose-900/60 px-2 py-0.5 text-xs font-bold text-rose-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {activeAlert.comment ? (
            <p className="mt-2 text-xs italic leading-relaxed text-rose-100/90">
              &quot;{activeAlert.comment}&quot;
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleDismiss}
              className={`${focusRing} rounded-xl border border-rose-500/40 bg-rose-900/40 px-3.5 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-900/70`}
            >
              🔕 Descartar Alerta
            </button>
            <button
              type="button"
              onClick={handleAttend}
              className={`${focusRing} rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg transition-transform hover:scale-[1.02] hover:bg-rose-500 active:scale-95`}
            >
              🏃 Ir a Atender Mesa
            </button>
          </div>
        </div>
      ) : toastMessage ? (
        <div
          data-testid="bad-review-attendance-toast"
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/95 p-3.5 text-emerald-100 shadow-xl backdrop-blur-md"
        >
          <CheckCircle2 className="size-5 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
