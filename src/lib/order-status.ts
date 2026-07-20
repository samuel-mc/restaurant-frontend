/**
 * Presentación del flujo de tracking del comensal.
 *
 * UI (producto): Recibido → En Cocina → En preparación → Entregado
 * Backend:       PENDING → ACCEPTED → IN_KITCHEN → DELIVERED
 *
 * El mapeo mantiene el contrato Spring Boot sin romper la UX pedida.
 */

import type { OrderStatus } from "@/types/api";

/** Claves del stepper visibles en la UI del comensal. */
export type TrackingStepKey =
  | "PENDING"
  | "IN_PREPARATION"
  | "READY"
  | "DELIVERED";

export interface TrackingStep {
  key: TrackingStepKey;
  label: string;
  description: string;
}

export const TRACKING_STEPS: TrackingStep[] = [
  {
    key: "PENDING",
    label: "Recibido",
    description: "Tu pedido ya llegó al restaurante",
  },
  {
    key: "IN_PREPARATION",
    label: "En Cocina",
    description: "El restaurante aceptó tu orden",
  },
  {
    key: "READY",
    label: "En preparación",
    description: "La cocina está preparando tu platillo",
  },
  {
    key: "DELIVERED",
    label: "Entregado",
    description: "¡Buen provecho!",
  },
];

/** Traduce el enum del backend al paso visual del stepper. */
export function toTrackingStepKey(
  status: OrderStatus,
): TrackingStepKey | "CANCELLED" {
  switch (status) {
    case "PENDING":
      return "PENDING";
    case "ACCEPTED":
      return "IN_PREPARATION";
    case "IN_KITCHEN":
      return "READY";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
  }
}

const STEP_INDEX: Record<TrackingStepKey, number> = {
  PENDING: 0,
  IN_PREPARATION: 1,
  READY: 2,
  DELIVERED: 3,
};

export function getStatusIndex(status: OrderStatus): number {
  const key = toTrackingStepKey(status);
  if (key === "CANCELLED") return -1;
  return STEP_INDEX[key];
}

export function getStatusLabel(status: OrderStatus): string {
  if (status === "CANCELLED") return "Cancelado";
  const key = toTrackingStepKey(status);
  return TRACKING_STEPS.find((step) => step.key === key)?.label ?? status;
}

export function getStatusDescription(status: OrderStatus): string {
  if (status === "CANCELLED") {
    return "Este pedido fue cancelado. Habla con el personal si necesitas ayuda.";
  }
  const key = toTrackingStepKey(status);
  return TRACKING_STEPS.find((step) => step.key === key)?.description ?? "";
}

export function getStatusTheme(status: OrderStatus): {
  hero: string;
  badge: string;
  ring: string;
  badgePulse: boolean;
} {
  const key = toTrackingStepKey(status);

  switch (key) {
    case "PENDING":
      return {
        hero: "from-amber-500 to-orange-600",
        badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        ring: "ring-amber-500",
        badgePulse: false,
      };
    case "IN_PREPARATION":
      return {
        hero: "from-amber-400 to-yellow-500",
        badge:
          "bg-yellow-400/20 text-yellow-800 dark:text-yellow-200 animate-pulse",
        ring: "ring-yellow-400",
        badgePulse: true,
      };
    case "READY":
      return {
        hero: "from-orange-500 to-amber-600",
        badge: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
        ring: "ring-orange-500",
        badgePulse: true,
      };
    case "DELIVERED":
      return {
        hero: "from-emerald-600 to-teal-700",
        badge: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
        ring: "ring-emerald-600",
        badgePulse: false,
      };
    default:
      return {
        hero: "from-neutral-500 to-neutral-700",
        badge: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-300",
        ring: "ring-neutral-500",
        badgePulse: false,
      };
  }
}
