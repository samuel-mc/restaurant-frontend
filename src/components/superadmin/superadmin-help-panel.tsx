"use client";

/**
 * Ayuda contextual ligera (?) por página SuperAdmin.
 * Focus trap + clic fuera + Escape; no bloquea scroll ni el flujo.
 */

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { COUPON_RISK_WINDOW_DAYS } from "@/lib/superadmin-attention";
import { saFocus, saSecondaryBtn } from "@/components/superadmin/superadmin-ui";

export type SuperAdminHelpTopic = "panel" | "tenants" | "coupons";

type HelpSection = { term: string; body: string };

const HELP: Record<
  SuperAdminHelpTopic,
  { title: string; sections: HelpSection[]; escalate: string }
> = {
  panel: {
    title: "Cómo leer el Panel",
    sections: [
      {
        term: "Atención ahora",
        body: "Cola priorizada: pago pendiente, luego suspendidos, luego cupones en riesgo. Cada fila abre el listado ya filtrado.",
      },
      {
        term: "Ingreso mensual estimado",
        body: "Cifra que envía el servidor de métricas. Es una estimación operativa, no facturación cerrada ni un extracto bancario.",
      },
      {
        term: "Tasa de suspensión",
        body: "Porcentaje de restaurantes suspendidos sobre el total registrados. No mide cancelaciones formales de contrato.",
      },
    ],
    escalate:
      "Si un cobro o suspensión no cuadra con finanzas o con el acuerdo del cliente, confirma con el equipo antes de cambiar el estado.",
  },
  tenants: {
    title: "Plan, cobro y acceso",
    sections: [
      {
        term: "Plan Básico / Pro",
        body: "Pro habilita sitio institucional y límites de menú más altos. Verás un resumen antes/después y confirmas antes de aplicar.",
      },
      {
        term: "Cobro",
        body: "«Al corriente» u «Pago pendiente». Pago pendiente es señal de riesgo; no suspende solo — la suspensión es una acción aparte.",
      },
      {
        term: "Suspender / Abrir panel",
        body: "Suspender bloquea el subdominio (pide escribir el slug). Abrir panel usa un token de soporte en otra pestaña; SuperAdmin se queda abierto.",
      },
    ],
    escalate:
      "Antes de suspender un local con clientes activos, alinea con quien lleva la cuenta. Los cambios quedan a tu cargo operativo.",
  },
  coupons: {
    title: "Ciclo de vida del cupón",
    sections: [
      {
        term: "Para qué sirve",
        body: "El código otorga un plan al registrar un restaurante nuevo. Si el local ya existe, cambia el plan en Restaurantes.",
      },
      {
        term: "En riesgo",
        body: `Activos que expiran en ≤${COUPON_RISK_WINDOW_DAYS} días o ya agotaron sus usos. Desactivar no borra el historial de canjes.`,
      },
      {
        term: "Crear y editar",
        body: "Revisas un resumen antes de crear o guardar. El código no se edita después de crear; ajusta descripción, plan, usos, expiración o actívalo/desactívalo.",
      },
    ],
    escalate:
      "Si un partner reporta que su código falló al registrarse, revisa usos, expiración y estado activo antes de crear un duplicado.",
  },
};

export function SuperAdminHelpPanel({ topic }: { topic: SuperAdminHelpTopic }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const content = HELP[topic];

  const containerRef = useModalFocusTrap({
    open,
    onEscape: () => setOpen(false),
    initialFocusRef: closeRef,
    lockScroll: false,
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const root = containerRef.current;
      if (root && !root.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, containerRef]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 ${saFocus}`}
        aria-label={open ? "Cerrar ayuda" : `Ayuda: ${content.title}`}
      >
        {open ? (
          <X className="size-4" aria-hidden />
        ) : (
          <CircleHelp className="size-4" aria-hidden />
        )}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={content.title}
          className="absolute right-0 z-40 mt-2 w-[min(calc(100vw-2rem),22rem)] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#111113] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)] sm:w-96 sm:max-w-none"
        >
          <p className="text-sm font-semibold text-white">{content.title}</p>
          <dl className="mt-3 space-y-3">
            {content.sections.map((section) => (
              <div key={section.term}>
                <dt className="text-xs font-semibold text-emerald-200/90">
                  {section.term}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {section.body}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-300">Escala: </span>
            {content.escalate}
          </p>
          <button
            ref={closeRef}
            type="button"
            className={`mt-4 w-full ${saSecondaryBtn} ${saFocus}`}
            onClick={() => setOpen(false)}
          >
            Cerrar ayuda
          </button>
        </div>
      ) : null}
    </div>
  );
}
