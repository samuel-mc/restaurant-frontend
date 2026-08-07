/**
 * Planes comerciales y estado de pago (early access / cupón).
 */

export type SubscriptionPlan = "BASIC" | "PRO";
export type PaymentStatus = "ACTIVE" | "PENDING_PAYMENT";

export const BASIC_MAX_PRODUCTS = 20;

export const BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE =
  `El Plan Básico permite hasta ${BASIC_MAX_PRODUCTS} platillos. Actualiza al Plan Pro para menú ilimitado.`;

/** Banner cuando el inventario supera el tope del menú público (p. ej. tras un downgrade). */
export function basicProductOverLimitMessage(currentCount: number): string {
  return (
    `El menú público solo muestra los primeros ${BASIC_MAX_PRODUCTS} de ${currentCount}. ` +
    `Actualiza al Plan Pro para publicar todos, o elimina platillos hasta quedar en ${BASIC_MAX_PRODUCTS}.`
  );
}

export function basicImportWouldExceedMessage(
  currentCount: number,
  fileRowCount: number,
): string {
  return (
    `El Plan Básico permite hasta ${BASIC_MAX_PRODUCTS} platillos. ` +
    `Ya tienes ${currentCount} y el archivo trae ${fileRowCount}. ` +
    `Actualiza al Plan Pro para menú ilimitado.`
  );
}

export function isProPlan(plan: string | null | undefined): boolean {
  return plan === "PRO";
}

export function isPaymentActive(status: string | null | undefined): boolean {
  return status === "ACTIVE" || !status;
}

/**
 * Fin de período vencido. `null` / vacío / inválido → no vencido
 * (sin fecha = sin corte automático).
 */
export function isPeriodExpired(
  currentPeriodEnd: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!currentPeriodEnd?.trim()) return false;
  const end = new Date(currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return false;
  return end <= nowMs;
}

/**
 * Menú ilimitado / Pro vigente: Pro + pago activo + período no vencido.
 * Sin `currentPeriodEnd` = vigente mientras el pago esté activo.
 */
export function hasUnlimitedMenu(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
  currentPeriodEnd?: string | null,
): boolean {
  if (!isProPlan(plan) || !isPaymentActive(paymentStatus)) return false;
  return !isPeriodExpired(currentPeriodEnd);
}

export function canPublishWebsite(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
  currentPeriodEnd?: string | null,
): boolean {
  return hasUnlimitedMenu(plan, paymentStatus, currentPeriodEnd);
}

/** Pickup / delivery / reservaciones: solo Plan Pro vigente. */
export function canUseProServiceModules(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
  currentPeriodEnd?: string | null,
): boolean {
  return hasUnlimitedMenu(plan, paymentStatus, currentPeriodEnd);
}

/** @deprecated Preferir {@link canUseProServiceModules}. */
export function canUsePickupAndDelivery(
  plan: string | null | undefined,
  paymentStatus: string | null | undefined,
  currentPeriodEnd?: string | null,
): boolean {
  return canUseProServiceModules(plan, paymentStatus, currentPeriodEnd);
}

export function planLabel(plan: string | null | undefined): string {
  if (plan === "PRO") return "Plan Pro";
  return "Plan Básico";
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (status === "PENDING_PAYMENT") return "Pago pendiente";
  return "Activo";
}
