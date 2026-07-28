/**
 * Presentación del flujo de tracking del comensal.
 *
 * UI (producto): Recibido → Confirmado → Preparando → Entregado
 * Backend:       PENDING → ACCEPTED → IN_KITCHEN → DELIVERED
 *
 * No prometemos «Listo» como paso: el backend no emite un estado diner-facing
 * aparte de IN_KITCHEN / DELIVERED. Copy de cierre varía por canal.
 */

import type { OrderType, OrderStatus } from "@/types/api";
import { formatTableLabel } from "@/lib/table-session";

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
    description:
      "Tu pedido ya llegó al restaurante. Te avisaremos aquí cuando lo confirmen.",
  },
  {
    key: "IN_PREPARATION",
    label: "Confirmado",
    description:
      "El restaurante aceptó tu pedido. Te avisaremos aquí cuando la cocina empiece.",
  },
  {
    key: "READY",
    label: "Preparando",
    description:
      "La cocina ya lo está preparando. Te avisaremos aquí cuando cambie el estado.",
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
    case "CLOSED":
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
  if (status === "CLOSED") return "Cuenta cerrada";
  const key = toTrackingStepKey(status);
  return TRACKING_STEPS.find((step) => step.key === key)?.label ?? status;
}

/** Título del resumen según canal (no siempre «cuenta de la mesa»). */
export function getOrderSummaryTitle(
  orderType: OrderType,
  tableNumber?: string | null,
): string {
  switch (orderType) {
    case "IN_TABLE": {
      const mesa = tableNumber?.trim();
      return mesa ? formatTableLabel(mesa) : "Pedido en mesa";
    }
    case "PICKUP":
      return "Para llevar";
    case "DELIVERY":
      return "A domicilio";
  }
}

/** Etiqueta corta de canal para meta del hero / chips. */
export function getOrderChannelLabel(
  orderType: OrderType,
  tableNumber?: string | null,
): string {
  switch (orderType) {
    case "IN_TABLE": {
      const mesa = tableNumber?.trim();
      return mesa ? formatTableLabel(mesa) : "En mesa";
    }
    case "PICKUP":
      return "Para llevar";
    case "DELIVERY":
      return "A domicilio";
  }
}

/**
 * Copy del hero: qué pasó + qué hacer mientras (sin inventar tiempos).
 * Canal ajusta el cierre y el “qué sigue” en cocina / entregado.
 */
export function getStatusDescription(
  status: OrderStatus,
  orderType: OrderType = "IN_TABLE",
): string {
  if (status === "CANCELLED") {
    return "Este pedido fue cancelado. Habla con el personal si necesitas ayuda.";
  }
  if (status === "CLOSED") {
    if (orderType === "IN_TABLE") {
      return "La cuenta de la mesa ya fue cobrada. ¡Gracias por tu visita!";
    }
    return "Este pedido ya quedó cerrado. ¡Gracias!";
  }

  switch (status) {
    case "PENDING":
      return (
        TRACKING_STEPS.find((step) => step.key === "PENDING")?.description ?? ""
      );
    case "ACCEPTED":
      return (
        TRACKING_STEPS.find((step) => step.key === "IN_PREPARATION")
          ?.description ?? ""
      );
    case "IN_KITCHEN":
      switch (orderType) {
        case "PICKUP":
          return "La cocina ya lo está preparando. Quédate cerca: te avisaremos aquí cuando puedas recogerlo.";
        case "DELIVERY":
          return "La cocina ya lo está preparando. Te avisaremos aquí cuando quede entregado.";
        case "IN_TABLE":
          return "La cocina ya lo está preparando. Puedes quedarte en la mesa; te avisaremos aquí cuando cambie el estado.";
      }
      break;
    case "DELIVERED":
      switch (orderType) {
        case "PICKUP":
          return "Ya puedes recogerlo en el local. ¡Buen provecho!";
        case "DELIVERY":
          return "Tu pedido ya fue entregado. ¡Buen provecho!";
        case "IN_TABLE":
          return "Ya te lo llevamos a la mesa. ¡Buen provecho!";
      }
      break;
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
        badge: "bg-yellow-400/20 text-yellow-800 dark:text-yellow-200",
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
