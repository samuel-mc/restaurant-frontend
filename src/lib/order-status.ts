/**
 * Presentación de estados de pedido para la UI del comensal.
 * Los valores canónicos coinciden con `OrderStatus` del backend.
 */

import type { OrderStatus } from "@/types/api";

export interface TrackingStep {
  /** Estado canónico del backend. */
  status: Exclude<OrderStatus, "CANCELLED">;
  /** Etiqueta visible (español). */
  label: string;
  /** Descripción corta bajo el paso. */
  description: string;
}

/** Pasos del stepper (excluye CANCELLED). */
export const TRACKING_STEPS: TrackingStep[] = [
  {
    status: "PENDING",
    label: "Pendiente",
    description: "Tu pedido llegó a cocina",
  },
  {
    status: "ACCEPTED",
    label: "Aceptado",
    description: "El restaurante lo confirmó",
  },
  {
    status: "IN_KITCHEN",
    label: "En preparación",
    description: "Se está cocinando tu orden",
  },
  {
    status: "DELIVERED",
    label: "Entregado",
    description: "¡Buen provecho!",
  },
];

const STATUS_INDEX: Record<OrderStatus, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  IN_KITCHEN: 2,
  DELIVERED: 3,
  CANCELLED: -1,
};

export function getStatusIndex(status: OrderStatus): number {
  return STATUS_INDEX[status] ?? 0;
}

export function getStatusLabel(status: OrderStatus): string {
  if (status === "CANCELLED") return "Cancelado";
  return TRACKING_STEPS.find((step) => step.status === status)?.label ?? status;
}

export function getStatusDescription(status: OrderStatus): string {
  if (status === "CANCELLED") {
    return "Este pedido fue cancelado. Habla con el personal si necesitas ayuda.";
  }
  return (
    TRACKING_STEPS.find((step) => step.status === status)?.description ?? ""
  );
}

/** Clases Tailwind según el estado actual (hero + acentos). */
export function getStatusTheme(status: OrderStatus): {
  hero: string;
  badge: string;
  ring: string;
} {
  switch (status) {
    case "PENDING":
      return {
        hero: "from-amber-500 to-orange-600",
        badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        ring: "ring-amber-500",
      };
    case "ACCEPTED":
      return {
        hero: "from-sky-500 to-blue-600",
        badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        ring: "ring-sky-500",
      };
    case "IN_KITCHEN":
      return {
        hero: "from-orange-500 to-rose-500",
        badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
        ring: "ring-orange-500",
      };
    case "DELIVERED":
      return {
        hero: "from-emerald-500 to-green-600",
        badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        ring: "ring-emerald-500",
      };
    case "CANCELLED":
      return {
        hero: "from-neutral-500 to-neutral-700",
        badge: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-300",
        ring: "ring-neutral-500",
      };
  }
}
