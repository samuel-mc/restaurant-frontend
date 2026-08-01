/**
 * Bootstrap API del tenant e2e: registro → Pro ACTIVE (SQL local) → ordering+pickup → producto.
 *
 * No depende de SuperAdmin (la contraseña local suele vivir en secrets no versionados).
 * Requiere Docker container `restaurant-db` accesible (compose del backend).
 */

import { execFileSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";
import { e2eEnv } from "./fixtures/env";

const TENANT_HEADER = "X-Tenant";

async function api<T>(
  path: string,
  init: RequestInit & { tenant?: string; token?: string } = {},
): Promise<{ status: number; body: T | null; raw: string }> {
  const { tenant, token, headers: extra, ...rest } = init;
  const headers = new Headers(extra);
  headers.set("Accept", "application/json");
  if (
    !(rest.body instanceof FormData) &&
    !headers.has("Content-Type") &&
    rest.body
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (tenant) headers.set(TENANT_HEADER, tenant);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${e2eEnv.apiUrl}${path}`, { ...rest, headers });
  const raw = await res.text();
  let body: T | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as T;
    } catch {
      body = null;
    }
  }
  return { status: res.status, body, raw };
}

async function ensureHealth(): Promise<void> {
  const res = await fetch(`${e2eEnv.apiUrl}/actuator/health`);
  if (!res.ok) {
    throw new Error(
      `Backend no disponible en ${e2eEnv.apiUrl} (health ${res.status}). Arranca docker compose.`,
    );
  }
}

async function ownerLogin(): Promise<string | null> {
  const { status, body } = await api<{ token: string }>("/api/v1/auth/login", {
    method: "POST",
    tenant: e2eEnv.tenantSlug,
    body: JSON.stringify({
      email: e2eEnv.ownerEmail,
      password: e2eEnv.ownerPassword,
    }),
  });
  if (status >= 400 || !body?.token) return null;
  return body.token;
}

async function registerTenant(): Promise<void> {
  const { status, raw } = await api("/api/v1/tenants/register", {
    method: "POST",
    body: JSON.stringify({
      restaurantName: e2eEnv.restaurantName,
      tenantSlug: e2eEnv.tenantSlug,
      ownerEmail: e2eEnv.ownerEmail,
      ownerName: e2eEnv.ownerName,
      ownerPassword: e2eEnv.ownerPassword,
      plan: "PRO",
      // Cupón seed de V6 (si existe); SQL de activateProViaSql es el fallback.
      couponCode: "PRO-DEMO-2026",
    }),
  });
  // Ya existe / conflicto: seguimos con login.
  if (status >= 400 && status !== 409) {
    // Reintento sin cupón (cupón inválido / agotado).
    const retry = await api("/api/v1/tenants/register", {
      method: "POST",
      body: JSON.stringify({
        restaurantName: e2eEnv.restaurantName,
        tenantSlug: e2eEnv.tenantSlug,
        ownerEmail: e2eEnv.ownerEmail,
        ownerName: e2eEnv.ownerName,
        ownerPassword: e2eEnv.ownerPassword,
        plan: "PRO",
      }),
    });
    if (retry.status >= 400 && retry.status !== 409) {
      if (/ya existe|already|subdominio|slug/i.test(retry.raw + raw)) return;
      throw new Error(
        `Registro tenant falló (${retry.status}): ${retry.raw} (prev ${status}: ${raw})`,
      );
    }
  }
}

/** Activa Pro+pago vía SQL (smoke local; no requiere SuperAdmin). */
function activateProViaSql(): void {
  const sql = `UPDATE restaurants SET plan = 'PRO', payment_status = 'ACTIVE' WHERE subdomain = '${e2eEnv.tenantSlug}';`;
  try {
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "restaurant-db",
        "psql",
        "-U",
        "postgres",
        "-d",
        "platolisto",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo activar Pro vía SQL en restaurant-db. ¿Docker compose arriba?\n${msg}`,
    );
  }
}

async function enableOrdering(ownerToken: string): Promise<void> {
  const { status, raw } = await api("/api/v1/admin/restaurants/profile", {
    method: "PUT",
    tenant: e2eEnv.tenantSlug,
    token: ownerToken,
    body: JSON.stringify({
      orderingEnabled: true,
      hasPickup: true,
      hasDelivery: false,
    }),
  });
  if (status >= 400) {
    throw new Error(`Activar ordering/pickup falló (${status}): ${raw}`);
  }
}

async function ensureProduct(ownerToken: string): Promise<void> {
  const products = await api<Array<{ name: string }>>(
    "/api/v1/admin/products",
    {
      tenant: e2eEnv.tenantSlug,
      token: ownerToken,
    },
  );
  if ((products.body ?? []).some((p) => p.name === e2eEnv.productName)) {
    return;
  }

  const categories = await api<Array<{ id: number; name: string }>>(
    "/api/v1/admin/categories",
    { tenant: e2eEnv.tenantSlug, token: ownerToken },
  );
  let categoryId = categories.body?.[0]?.id;
  if (categoryId == null) {
    const created = await api<{ id: number }>("/api/v1/admin/categories", {
      method: "POST",
      tenant: e2eEnv.tenantSlug,
      token: ownerToken,
      body: JSON.stringify({ name: "E2E", displayOrder: 0 }),
    });
    if (created.status >= 400 || created.body?.id == null) {
      throw new Error(
        `Crear categoría falló (${created.status}): ${created.raw}`,
      );
    }
    categoryId = created.body.id;
  }

  const product = await api("/api/v1/admin/products", {
    method: "POST",
    tenant: e2eEnv.tenantSlug,
    token: ownerToken,
    body: JSON.stringify({
      name: e2eEnv.productName,
      description: "Platillo para smoke E2E",
      price: 99.0,
      categoryId,
    }),
  });
  if (product.status >= 400) {
    throw new Error(`Crear producto falló (${product.status}): ${product.raw}`);
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log(`[e2e] API ${e2eEnv.apiUrl} · tenant ${e2eEnv.tenantSlug}`);
  await ensureHealth();

  let ownerToken = await ownerLogin();
  if (!ownerToken) {
    await registerTenant();
    ownerToken = await ownerLogin();
  }
  if (!ownerToken) {
    throw new Error(
      `No se pudo autenticar owner ${e2eEnv.ownerEmail} en tenant ${e2eEnv.tenantSlug}`,
    );
  }

  activateProViaSql();
  await enableOrdering(ownerToken);
  await ensureProduct(ownerToken);
  console.log(`[e2e] Tenant listo: ${e2eEnv.tenantBaseUrl}`);
}
