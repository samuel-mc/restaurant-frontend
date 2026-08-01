/**
 * Credenciales y URLs del smoke E2E.
 * Override con variables de entorno (ver e2e/env.example).
 */

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

const slug = env("E2E_TENANT_SLUG", "e2esmoke");
const feOrigin = env("E2E_FE_ORIGIN", "http://localhost:3000");
const apiUrl = env("E2E_API_URL", "http://localhost:8080").replace(/\/$/, "");

export const e2eEnv = {
  apiUrl,
  feOrigin,
  tenantSlug: slug,
  tenantBaseUrl: `http://${slug}.localhost:3000`,
  ownerEmail: env("E2E_OWNER_EMAIL", "e2e-owner@platolisto.test"),
  ownerPassword: env("E2E_OWNER_PASSWORD", "E2eSmokePass123!"),
  ownerName: env("E2E_OWNER_NAME", "E2E Owner"),
  restaurantName: env("E2E_RESTAURANT_NAME", "E2E Smoke Kitchen"),
  productName: env("E2E_PRODUCT_NAME", "E2E Plato Smoke"),
} as const;

export type E2eEnv = typeof e2eEnv;
