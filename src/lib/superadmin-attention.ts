/**
 * Cola «Atención ahora» del Panel SuperAdmin.
 * Contrato: pago pendiente → suspendidos → cupones en riesgo.
 */

import type {
  SuperAdminCoupon,
  SuperAdminMetrics,
  SuperAdminMetricsApi,
  SuperAdminTenant,
} from "@/types/superadmin";

/** Días por defecto para cupón «expira pronto» (brief shape). */
export const COUPON_RISK_WINDOW_DAYS = 7;

export type AttentionItemId =
  | "pending_payment"
  | "suspended"
  | "coupons_at_risk";

export type AttentionItem = {
  id: AttentionItemId;
  label: string;
  count: number;
  why: string;
  href: string;
  cta: string;
};

export function isCouponExhausted(coupon: SuperAdminCoupon): boolean {
  return (
    coupon.active &&
    coupon.maxRedemptions != null &&
    coupon.redemptionCount >= coupon.maxRedemptions
  );
}

export function isCouponExpiringSoon(
  coupon: SuperAdminCoupon,
  nowMs: number,
  windowDays: number,
): boolean {
  if (!coupon.active || !coupon.expiresAt) return false;
  const expires = new Date(coupon.expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return expires >= nowMs && expires <= nowMs + windowMs;
}

export function isCouponAtRisk(
  coupon: SuperAdminCoupon,
  nowMs = Date.now(),
  windowDays = COUPON_RISK_WINDOW_DAYS,
): boolean {
  return (
    isCouponExhausted(coupon) ||
    isCouponExpiringSoon(coupon, nowMs, windowDays)
  );
}

export function countPendingPaymentTenants(
  tenants: SuperAdminTenant[],
): number {
  return tenants.filter((t) => t.paymentStatus === "PENDING_PAYMENT").length;
}

export function summarizeCouponRisk(
  coupons: SuperAdminCoupon[],
  windowDays = COUPON_RISK_WINDOW_DAYS,
  nowMs = Date.now(),
): {
  atRisk: number;
  expiringSoon: number;
  exhausted: number;
} {
  let expiringSoon = 0;
  let exhausted = 0;
  let atRisk = 0;
  for (const c of coupons) {
    const exhaustedHit = isCouponExhausted(c);
    const expiringHit = isCouponExpiringSoon(c, nowMs, windowDays);
    if (exhaustedHit) exhausted += 1;
    if (expiringHit) expiringSoon += 1;
    if (exhaustedHit || expiringHit) atRisk += 1;
  }
  return { atRisk, expiringSoon, exhausted };
}

/**
 * Normaliza métricas del API y completa atención desde listas
 * cuando el backend aún no envía esos campos.
 */
export function enrichSuperAdminMetrics(
  api: SuperAdminMetricsApi,
  tenants: SuperAdminTenant[],
  coupons: SuperAdminCoupon[],
  options?: { windowDays?: number; nowMs?: number },
): SuperAdminMetrics {
  const windowDays = options?.windowDays ?? COUPON_RISK_WINDOW_DAYS;
  const nowMs = options?.nowMs ?? Date.now();
  const derivedPending = countPendingPaymentTenants(tenants);
  const derivedCoupons = summarizeCouponRisk(coupons, windowDays, nowMs);

  return {
    ...api,
    pendingPaymentTenants:
      typeof api.pendingPaymentTenants === "number"
        ? api.pendingPaymentTenants
        : derivedPending,
    couponsAtRisk:
      typeof api.couponsAtRisk === "number"
        ? api.couponsAtRisk
        : derivedCoupons.atRisk,
    couponsExpiringSoon:
      typeof api.couponsExpiringSoon === "number"
        ? api.couponsExpiringSoon
        : derivedCoupons.expiringSoon,
    couponsExhausted:
      typeof api.couponsExhausted === "number"
        ? api.couponsExhausted
        : derivedCoupons.exhausted,
    couponRiskWindowDays:
      typeof api.couponRiskWindowDays === "number"
        ? api.couponRiskWindowDays
        : windowDays,
  };
}

/** Cola ordenada: solo ítems con count > 0. */
export function buildAttentionQueue(
  metrics: SuperAdminMetrics,
): AttentionItem[] {
  const days = metrics.couponRiskWindowDays;
  const couponWhyParts: string[] = [];
  if (metrics.couponsExpiringSoon > 0) {
    couponWhyParts.push(
      `${metrics.couponsExpiringSoon} expira${metrics.couponsExpiringSoon === 1 ? "" : "n"} en ≤${days} días`,
    );
  }
  if (metrics.couponsExhausted > 0) {
    couponWhyParts.push(
      `${metrics.couponsExhausted} con usos agotados`,
    );
  }

  const couponHref =
    metrics.couponsExhausted > 0 && metrics.couponsExpiringSoon === 0
      ? "/superadmin/coupons?risk=exhausted"
      : metrics.couponsExpiringSoon > 0 && metrics.couponsExhausted === 0
        ? "/superadmin/coupons?risk=expiring"
        : "/superadmin/coupons?risk=any";

  const catalog: AttentionItem[] = [
    {
      id: "pending_payment",
      label: "Pago pendiente",
      count: metrics.pendingPaymentTenants,
      why: "Revisar cobro antes de que el local quede fuera de servicio.",
      href: "/superadmin/tenants?status=pending_payment",
      cta: "Ver cobros pendientes",
    },
    {
      id: "suspended",
      label: "Suspendidos",
      count: metrics.suspendedTenants,
      why: "Reactivar o confirmar suspensión; el subdominio está bloqueado.",
      href: "/superadmin/tenants?status=suspended",
      cta: "Ver suspendidos",
    },
    {
      id: "coupons_at_risk",
      label: "Cupones en riesgo",
      count: metrics.couponsAtRisk,
      why:
        couponWhyParts.length > 0
          ? couponWhyParts.join(" · ")
          : "Activos que expiran pronto o ya no tienen usos.",
      href: couponHref,
      cta: "Ver cupones en riesgo",
    },
  ];

  return catalog.filter((item) => item.count > 0);
}
