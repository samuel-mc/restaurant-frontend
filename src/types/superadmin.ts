/**
 * Tipos del backoffice global (SuperAdmin).
 */

export type SuperAdminPlan = "BASIC" | "PRO" | "ENTERPRISE";

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

export interface SuperAdminMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  proTenants: number;
  basicTenants: number;
  estimatedMrr: number;
  churnRate: number;
  registrationGrowth: Array<{ month: string; count: number }>;
}

export interface ImpersonateResult {
  token: string;
  tenantSlug: string;
  restaurantName: string;
  loginPath: string;
}
