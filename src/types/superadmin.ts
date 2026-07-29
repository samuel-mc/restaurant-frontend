/**
 * Tipos del backoffice global (SuperAdmin).
 */

export type SuperAdminPlan = "BASIC" | "PRO";

export type SuperAdminPaymentStatus = "ACTIVE" | "PENDING_PAYMENT";

export interface SuperAdminTenant {
  id: number;
  name: string;
  subdomain: string;
  plan: string;
  paymentStatus: string;
  active: boolean;
  websitePublished: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Métricas de Panel. Campos de atención pueden venir del API Spring
 * o enriquecerse en servidor a partir de tenants/cupones.
 */
export interface SuperAdminMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  proTenants: number;
  basicTenants: number;
  /** MRR estimado en pesos (unidad del servidor; no centavos). */
  estimatedMrr: number;
  /** ISO 4217, p.ej. MXN — solo para formateo. */
  estimatedMrrCurrency?: string;
  estimatedMrrAsOf?: string;
  estimatedMrrPeriod?: string;
  estimatedMrrMethod?: string;
  estimatedMrrLabelEs?: string;
  estimatedMrrDisclaimerEs?: string;
  estimatedMrrUnitPriceMxn?: number | null;
  estimatedMrrProActiveCount?: number;
  churnRate: number;
  registrationGrowth: Array<{ month: string; count: number }>;
  /** Restaurantes con cobro pendiente. */
  pendingPaymentTenants: number;
  /** Cupones activos en riesgo (expiran pronto o agotados). */
  couponsAtRisk: number;
  couponsExpiringSoon: number;
  couponsExhausted: number;
  /** Ventana en días para «expira pronto». */
  couponRiskWindowDays: number;
}

/** Respuesta cruda del API (campos de atención opcionales hasta que el backend los exponga). */
export type SuperAdminMetricsApi = Omit<
  SuperAdminMetrics,
  | "pendingPaymentTenants"
  | "couponsAtRisk"
  | "couponsExpiringSoon"
  | "couponsExhausted"
  | "couponRiskWindowDays"
> &
  Partial<
    Pick<
      SuperAdminMetrics,
      | "pendingPaymentTenants"
      | "couponsAtRisk"
      | "couponsExpiringSoon"
      | "couponsExhausted"
      | "couponRiskWindowDays"
    >
  >;

export interface ImpersonateResult {
  /** Código de un solo uso (no es el JWT). */
  code: string;
  tenantSlug: string;
  restaurantName: string;
  loginPath: string;
  handoffExpiresInSeconds?: number;
  expiresInSeconds?: number;
  impersonatedBy?: string;
  impersonatedAs?: string;
}

export interface SuperAdminCoupon {
  id: number;
  code: string;
  description: string | null;
  grantsPlan: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface SuperAdminCouponCreateInput {
  code: string;
  description?: string;
  grantsPlan?: SuperAdminPlan;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}

export interface SuperAdminCouponUpdateInput {
  description?: string | null;
  grantsPlan?: SuperAdminPlan;
  maxRedemptions?: number | null;
  clearMaxRedemptions?: boolean;
  expiresAt?: string | null;
  active?: boolean;
}
