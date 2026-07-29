/**
 * Planes comerciales y estado de pago (early access / cupón).
 */

export type SubscriptionPlan = "BASIC" | "PRO";
export type PaymentStatus = "ACTIVE" | "PENDING_PAYMENT";

export const BASIC_MAX_PRODUCTS = 30;

export function isProPlan(plan: string | null | undefined): boolean {
  return plan === "PRO";
}

export function isPaymentActive(status: string | null | undefined): boolean {
  return status === "ACTIVE" || !status;
}

export function canPublishWebsite(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
): boolean {
  return isProPlan(plan) && isPaymentActive(paymentStatus);
}

/** Pickup / delivery / reservaciones: solo Plan Pro con pago activo. */
export function canUseProServiceModules(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
): boolean {
  return isProPlan(plan) && isPaymentActive(paymentStatus);
}

/** @deprecated Preferir {@link canUseProServiceModules}. */
export function canUsePickupAndDelivery(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
): boolean {
  return canUseProServiceModules(plan, paymentStatus);
}

export function planLabel(plan: string | null | undefined): string {
  if (plan === "PRO") return "Plan Pro";
  return "Plan Básico";
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (status === "PENDING_PAYMENT") return "Pago pendiente";
  return "Activo";
}
