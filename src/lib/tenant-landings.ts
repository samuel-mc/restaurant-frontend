/**
 * Registro de landings institucionales **custom por tenant**.
 *
 * Operación (decenas de clientes + fee de setup):
 * 1. Cliente Pro paga / canjea cupón.
 * 2. Diseño y desarrollo de su landing dedicada.
 * 3. Se agrega aquí: `slug → componente`.
 * 4. Con `websitePublished` + entrada en este mapa, el sitio sale al aire.
 *
 * No es multi-template genérico: cada entrada es un sitio propio.
 */

import type { ComponentType } from "react";
import { RestaurantLanding } from "@/components/marketing/restaurant-landing";
import type { Product } from "@/types/api";
import type { RestaurantBrand } from "@/types/restaurant-brand";

export type TenantLandingProps = {
  brand: RestaurantBrand;
  products: Product[];
};

export type TenantLandingComponent = ComponentType<TenantLandingProps>;

/**
 * Mapa subdominio → landing dedicada.
 * Agregar un cliente nuevo = nuevo componente + una línea aquí.
 */
const TENANT_LANDINGS: Readonly<Record<string, TenantLandingComponent>> = {
  /** Demo italiano (primera landing entregada). */
  latrattoria: RestaurantLanding,
  /** Alias histórico del mismo demo. */
  "la-trattoria": RestaurantLanding,
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/** Componente custom del tenant, o `null` si aún no se entregó. */
export function getTenantLanding(
  slug: string,
): TenantLandingComponent | null {
  const key = normalizeSlug(slug);
  if (!key) return null;
  return TENANT_LANDINGS[key] ?? null;
}

export function hasTenantLanding(slug: string): boolean {
  return getTenantLanding(slug) != null;
}

/** Slugs con landing ya registrada (ops / debug). */
export function listTenantLandingSlugs(): string[] {
  return Object.keys(TENANT_LANDINGS);
}
