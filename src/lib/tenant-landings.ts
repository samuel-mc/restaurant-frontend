/**
 * Registro de landings institucionales **custom por tenant**.
 *
 * Operación (decenas de clientes + fee de setup):
 * 1. Cliente Pro paga / canjea cupón.
 * 2. Diseño y desarrollo de su landing dedicada.
 * 3. Se agrega aquí: `slug → componente` (+ `envs` si solo aplica en QA/local).
 * 4. Con `websitePublished` + entrada en este mapa, el sitio sale al aire.
 *
 * No es multi-template genérico: cada entrada es un sitio propio.
 */

import type { ComponentType } from "react";
import { CafeDeLaFeLanding } from "@/components/marketing/cafe-de-la-fe-landing";
import { RestaurantLanding } from "@/components/marketing/restaurant-landing";
import { getAppEnv, type AppEnv } from "@/lib/app-env";
import type { Product } from "@/types/api";
import type { RestaurantBrand } from "@/types/restaurant-brand";

export type TenantLandingProps = {
  brand: RestaurantBrand;
  products: Product[];
};

export type TenantLandingComponent = ComponentType<TenantLandingProps>;

type TenantLandingEntry = {
  component: TenantLandingComponent;
  /**
   * Entornos donde la landing está activa.
   * Si se omite, disponible en todos (`local` / `qa` / `production`).
   */
  envs?: readonly AppEnv[];
};

/**
 * Mapa subdominio → landing dedicada.
 * Agregar un cliente nuevo = nuevo componente + una línea aquí.
 */
const TENANT_LANDINGS: Readonly<Record<string, TenantLandingEntry>> = {
  /** Demo italiano (primera landing entregada). */
  latrattoria: { component: RestaurantLanding },
  /** Alias histórico del mismo demo. */
  "la-trattoria": { component: RestaurantLanding },
  /** Cafetería de prueba — solo QA / local. */
  cafedelafe: {
    component: CafeDeLaFeLanding,
    envs: ["local", "qa"],
  },
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function isEntryActive(entry: TenantLandingEntry): boolean {
  if (!entry.envs || entry.envs.length === 0) return true;
  return entry.envs.includes(getAppEnv());
}

/** Componente custom del tenant, o `null` si aún no se entregó / no aplica al env. */
export function getTenantLanding(
  slug: string,
): TenantLandingComponent | null {
  const key = normalizeSlug(slug);
  if (!key) return null;
  const entry = TENANT_LANDINGS[key];
  if (!entry || !isEntryActive(entry)) return null;
  return entry.component;
}

export function hasTenantLanding(slug: string): boolean {
  return getTenantLanding(slug) != null;
}

/** Slugs con landing ya registrada y activa en el entorno actual (ops / debug). */
export function listTenantLandingSlugs(): string[] {
  return Object.entries(TENANT_LANDINGS)
    .filter(([, entry]) => isEntryActive(entry))
    .map(([slug]) => slug);
}
