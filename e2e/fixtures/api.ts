/**
 * Helpers API para smoke E2E (auth admin, QR mesa, liberar mesa).
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { e2eEnv } from "./env";

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

export async function ownerApiLogin(): Promise<string> {
  const { status, body, raw } = await api<{ token: string }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      tenant: e2eEnv.tenantSlug,
      body: JSON.stringify({
        email: e2eEnv.ownerEmail,
        password: e2eEnv.ownerPassword,
      }),
    },
  );
  if (status >= 400 || !body?.token) {
    throw new Error(`Owner API login falló (${status}): ${raw}`);
  }
  return body.token;
}

export async function signTableQr(
  ownerToken: string,
  tableNumber: string,
): Promise<{ tableNumber: string; tableToken: string }> {
  const { status, body, raw } = await api<{
    links: Array<{ tableNumber: string; tableToken: string }>;
  }>("/api/v1/admin/table-qr/sign", {
    method: "POST",
    tenant: e2eEnv.tenantSlug,
    token: ownerToken,
    body: JSON.stringify({ tableNumbers: [tableNumber] }),
  });
  const link = body?.links?.[0];
  if (status >= 400 || !link?.tableToken) {
    throw new Error(`Sign table QR falló (${status}): ${raw}`);
  }
  return {
    tableNumber: link.tableNumber,
    tableToken: link.tableToken,
  };
}

type ActiveOrder = {
  uuid: string;
  status: string;
  orderType: string;
  tableNumber?: string | null;
  linkedTables?: string[] | null;
};

/** Cierra cuentas IN_TABLE que ocupen la mesa (avanza a DELIVERED si hace falta). */
export async function freeTableIfOccupied(
  ownerToken: string,
  tableNumber: string,
): Promise<void> {
  const table = tableNumber.trim();
  const { status, body, raw } = await api<ActiveOrder[]>(
    "/api/v1/admin/orders/active",
    { tenant: e2eEnv.tenantSlug, token: ownerToken },
  );
  if (status >= 400 || !body) {
    throw new Error(`Listar activas falló (${status}): ${raw}`);
  }

  const occupying = body.filter((order) => {
    if (order.orderType !== "IN_TABLE") return false;
    const primary = order.tableNumber?.trim();
    const linked = (order.linkedTables ?? []).map((t) => t.trim());
    return primary === table || linked.includes(table);
  });

  for (const order of occupying) {
    let current = order.status;
    const path = `/api/v1/admin/orders/${order.uuid}/status`;
    while (current === "PENDING" || current === "ACCEPTED" || current === "IN_KITCHEN") {
      const next =
        current === "PENDING"
          ? "ACCEPTED"
          : current === "ACCEPTED"
            ? "IN_KITCHEN"
            : "DELIVERED";
      const patch = await api(path, {
        method: "PATCH",
        tenant: e2eEnv.tenantSlug,
        token: ownerToken,
        body: JSON.stringify({ status: next }),
      });
      if (patch.status >= 400) {
        throw new Error(
          `Avanzar ${order.uuid} ${current}→${next} falló (${patch.status}): ${patch.raw}`,
        );
      }
      current = next;
    }
    if (current === "DELIVERED") {
      const closed = await api(`/api/v1/admin/orders/${order.uuid}/close`, {
        method: "PATCH",
        tenant: e2eEnv.tenantSlug,
        token: ownerToken,
        body: JSON.stringify({ paymentMethod: "CASH" }),
      });
      if (closed.status >= 400) {
        throw new Error(
          `Cerrar ${order.uuid} falló (${closed.status}): ${closed.raw}`,
        );
      }
    }
  }
}

export function buildTableMenuPath(
  tableNumber: string,
  tableToken: string,
): string {
  const params = new URLSearchParams();
  params.set("m", tableNumber);
  params.set("t", tableToken);
  return `/menu?${params.toString()}`;
}

export async function updateRestaurantProfile(
  ownerToken: string,
  patch: {
    orderingEnabled?: boolean;
    hasPickup?: boolean;
    hasDelivery?: boolean;
  },
  tenantSlug: string = e2eEnv.tenantSlug,
): Promise<void> {
  const { status, raw } = await api("/api/v1/admin/restaurants/profile", {
    method: "PUT",
    tenant: tenantSlug,
    token: ownerToken,
    body: JSON.stringify(patch),
  });
  if (status >= 400) {
    throw new Error(`Actualizar profile falló (${status}): ${raw}`);
  }
}

type StaffMember = {
  id: string;
  name: string;
  role: string;
  active?: boolean;
};

/** Crea o actualiza staff con PIN conocido (idempotente por nombre). */
export async function ensureStaffMember(
  ownerToken: string,
  input: { name: string; role: "MESERO" | "COCINA"; pin: string },
): Promise<StaffMember> {
  const listed = await api<StaffMember[]>("/api/v1/admin/team", {
    tenant: e2eEnv.tenantSlug,
    token: ownerToken,
  });
  if (listed.status >= 400 || !listed.body) {
    throw new Error(`Listar team falló (${listed.status}): ${listed.raw}`);
  }

  const existing = listed.body.find(
    (m) => m.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
  );

  if (existing) {
    const patched = await api<StaffMember>(
      `/api/v1/admin/team/${existing.id}`,
      {
        method: "PATCH",
        tenant: e2eEnv.tenantSlug,
        token: ownerToken,
        body: JSON.stringify({
          name: input.name,
          role: input.role,
          pin: input.pin,
          active: true,
        }),
      },
    );
    if (patched.status >= 400 || !patched.body) {
      throw new Error(
        `Actualizar staff ${input.name} falló (${patched.status}): ${patched.raw}`,
      );
    }
    return patched.body;
  }

  const created = await api<StaffMember>("/api/v1/admin/team", {
    method: "POST",
    tenant: e2eEnv.tenantSlug,
    token: ownerToken,
    body: JSON.stringify({
      name: input.name,
      role: input.role,
      pin: input.pin,
    }),
  });
  if (created.status >= 400 || !created.body) {
    throw new Error(
      `Crear staff ${input.name} falló (${created.status}): ${created.raw}`,
    );
  }
  return created.body;
}

export async function ensureE2eStaff(ownerToken: string): Promise<void> {
  await ensureStaffMember(ownerToken, {
    name: e2eEnv.meseroName,
    role: "MESERO",
    pin: e2eEnv.meseroPin,
  });
  await ensureStaffMember(ownerToken, {
    name: e2eEnv.cocinaName,
    role: "COCINA",
    pin: e2eEnv.cocinaPin,
  });
}

export const BASIC_MAX_PRODUCTS = 30;
export const BASIC_PRODUCT_LIMIT_MESSAGE =
  "El Plan Básico permite hasta 30 platillos. Actualiza al Plan Pro para menú ilimitado.";

export type AdminProduct = {
  uuid: string;
  name: string;
  price: number;
  isAvailable: boolean;
  categoryId?: number;
};

function runTenantPlanSql(sql: string): void {
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
    throw new Error(`SQL plan falló en restaurant-db:\n${msg}`);
  }
}

/** Cambia plan vía SQL (mismo patrón que global-setup). Restaura PRO tras E2E-13. */
export function setTenantPlan(plan: "BASIC" | "PRO"): void {
  const sql =
    plan === "PRO"
      ? `UPDATE restaurants SET plan = 'PRO', payment_status = 'ACTIVE' WHERE subdomain = '${e2eEnv.tenantSlug}';`
      : `UPDATE restaurants SET plan = 'BASIC' WHERE subdomain = '${e2eEnv.tenantSlug}';`;
  runTenantPlanSql(sql);
}

/** Borra canje previo de un cupón para re-probar redeem en e2esmoke. */
export function clearCouponRedemption(
  code: string,
  tenantSlug: string = e2eEnv.tenantSlug,
): void {
  const safeCode = code.replace(/'/g, "''");
  const safeSlug = tenantSlug.replace(/'/g, "''");
  runTenantPlanSql(`
    DELETE FROM coupon_redemptions
    WHERE restaurant_id = (SELECT id FROM restaurants WHERE subdomain = '${safeSlug}')
      AND coupon_id = (SELECT id FROM coupons WHERE code = '${safeCode}');
  `);
}

export async function ensureCategoryId(ownerToken: string): Promise<number> {
  const categories = await api<Array<{ id: number; name: string }>>(
    "/api/v1/admin/categories",
    { tenant: e2eEnv.tenantSlug, token: ownerToken },
  );
  if (categories.status >= 400) {
    throw new Error(
      `Listar categorías falló (${categories.status}): ${categories.raw}`,
    );
  }
  const existing = categories.body?.[0]?.id;
  if (existing != null) return existing;

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
  return created.body.id;
}

export async function listAdminProducts(
  ownerToken: string,
): Promise<AdminProduct[]> {
  const { status, body, raw } = await api<AdminProduct[]>(
    "/api/v1/admin/products",
    { tenant: e2eEnv.tenantSlug, token: ownerToken },
  );
  if (status >= 400 || !body) {
    throw new Error(`Listar productos falló (${status}): ${raw}`);
  }
  return body;
}

export async function createAdminProduct(
  ownerToken: string,
  input: { name: string; price: number; description?: string },
): Promise<AdminProduct> {
  const categoryId = await ensureCategoryId(ownerToken);
  const { status, body, raw } = await api<AdminProduct>(
    "/api/v1/admin/products",
    {
      method: "POST",
      tenant: e2eEnv.tenantSlug,
      token: ownerToken,
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? "Platillo E2E",
        price: input.price,
        categoryId,
      }),
    },
  );
  if (status >= 400 || !body?.uuid) {
    throw new Error(`Crear producto falló (${status}): ${raw}`);
  }
  return body;
}

/** Intento de alta; no lanza — para assert del límite Basic. */
export async function tryCreateAdminProduct(
  ownerToken: string,
  input: { name: string; price: number },
): Promise<{ status: number; error: string | null; raw: string }> {
  const categoryId = await ensureCategoryId(ownerToken);
  const { status, body, raw } = await api<{ error?: string }>(
    "/api/v1/admin/products",
    {
      method: "POST",
      tenant: e2eEnv.tenantSlug,
      token: ownerToken,
      body: JSON.stringify({
        name: input.name,
        description: "Límite E2E",
        price: input.price,
        categoryId,
      }),
    },
  );
  return {
    status,
    error: body?.error ?? null,
    raw,
  };
}

export async function deleteAdminProduct(
  ownerToken: string,
  uuid: string,
): Promise<void> {
  const { status, raw } = await api(`/api/v1/admin/products/${uuid}`, {
    method: "DELETE",
    tenant: e2eEnv.tenantSlug,
    token: ownerToken,
  });
  if (status >= 400 && status !== 404) {
    throw new Error(`Borrar producto ${uuid} falló (${status}): ${raw}`);
  }
}

export async function toggleProductAvailability(
  ownerToken: string,
  uuid: string,
): Promise<AdminProduct> {
  const { status, body, raw } = await api<AdminProduct>(
    `/api/v1/admin/products/${uuid}/toggle-availability`,
    {
      method: "PATCH",
      tenant: e2eEnv.tenantSlug,
      token: ownerToken,
    },
  );
  if (status >= 400 || !body) {
    throw new Error(`Toggle disponibilidad falló (${status}): ${raw}`);
  }
  return body;
}

export type ModifierGroupSeed = {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: Array<{ name: string; priceDelta: number }>;
};

export async function replaceProductModifiers(
  ownerToken: string,
  productUuid: string,
  groups: ModifierGroupSeed[],
): Promise<void> {
  const { status, raw } = await api(
    `/api/v1/admin/products/${productUuid}/modifier-groups`,
    {
      method: "PUT",
      tenant: e2eEnv.tenantSlug,
      token: ownerToken,
      body: JSON.stringify({
        groups: groups.map((g, gi) => ({
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          displayOrder: gi,
          options: g.options.map((o, oi) => ({
            name: o.name,
            priceDelta: o.priceDelta,
            available: true,
            displayOrder: oi,
          })),
        })),
      }),
    },
  );
  if (status >= 400) {
    throw new Error(`Reemplazar modificadores falló (${status}): ${raw}`);
  }
}

/** Borra productos cuyo nombre empieza con el prefijo (cleanup E2E). */
export async function deleteProductsByNamePrefix(
  ownerToken: string,
  prefix: string,
): Promise<void> {
  const products = await listAdminProducts(ownerToken);
  for (const p of products) {
    if (p.name.startsWith(prefix)) {
      await deleteAdminProduct(ownerToken, p.uuid);
    }
  }
}

export type RegisteredTenant = {
  tenantSlug: string;
  ownerEmail: string;
  ownerPassword: string;
  plan: string;
  paymentStatus: string;
};

/** Registra un tenant desechable (sin cleanup API; orphan local OK). */
export async function registerDisposableTenant(input?: {
  plan?: "BASIC" | "PRO";
  couponCode?: string;
}): Promise<RegisteredTenant> {
  const stamp = Date.now().toString(36);
  const tenantSlug = `e2ereg${stamp}`.slice(0, 40);
  const ownerEmail = `e2e-reg-${stamp}@platolisto.test`;
  const ownerPassword = e2eEnv.ownerPassword;
  const body: Record<string, string> = {
    restaurantName: `E2E Reg ${stamp}`,
    tenantSlug,
    ownerEmail,
    ownerName: "E2E Reg Owner",
    ownerPassword,
    plan: input?.plan ?? "BASIC",
  };
  if (input?.couponCode) body.couponCode = input.couponCode;

  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { status, body: res, raw } = await api<{
      tenantSlug: string;
      plan: string;
      paymentStatus: string;
    }>("/api/v1/tenants/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (status < 400 && res?.tenantSlug) {
      return {
        tenantSlug: res.tenantSlug,
        ownerEmail,
        ownerPassword,
        plan: res.plan,
        paymentStatus: res.paymentStatus,
      };
    }
    lastError = `Registro tenant falló (${status}): ${raw}`;
    if (status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function tenantOwnerLogin(
  tenantSlug: string,
  email: string,
  password: string,
): Promise<string> {
  const { status, body, raw } = await api<{ token: string }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      tenant: tenantSlug,
      body: JSON.stringify({ email, password }),
    },
  );
  if (status >= 400 || !body?.token) {
    throw new Error(`Login owner ${email}@${tenantSlug} falló (${status}): ${raw}`);
  }
  return body.token;
}

export async function redeemCoupon(
  ownerToken: string,
  code: string,
  tenantSlug: string,
): Promise<{ message: string; plan: string; paymentStatus: string }> {
  const { status, body, raw } = await api<{
    message?: string;
    plan: string;
    paymentStatus: string;
  }>("/api/v1/admin/billing/redeem-coupon", {
    method: "POST",
    tenant: tenantSlug,
    token: ownerToken,
    body: JSON.stringify({ code }),
  });
  if (status >= 400 || !body?.plan) {
    throw new Error(`Redeem cupón falló (${status}): ${raw}`);
  }
  return {
    message: body.message ?? "",
    plan: body.plan,
    paymentStatus: body.paymentStatus,
  };
}

/**
 * Resuelve contraseña SuperAdmin usable (env o candidatos locales).
 * `null` → el test debe hacer skip (DB sin bootstrap / secret distinto).
 */
export async function resolveSuperadminPassword(): Promise<string | null> {
  const candidates = [
    e2eEnv.superadminPassword,
    "LocalDevOnly!ChangeMe92",
    // Hash legado en DBs locales anteriores al ban de bootstrap.
    "SuperAdmin123!",
  ].filter((p) => p.length > 0);

  const tried = new Set<string>();
  for (const password of candidates) {
    if (tried.has(password)) continue;
    tried.add(password);
    const { status } = await api<{ token?: string }>(
      "/api/v1/superadmin/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: e2eEnv.superadminEmail,
          password,
        }),
      },
    );
    if (status < 400) return password;
  }
  return null;
}

/**
 * El rate limit de registro es in-memory en el backend.
 * Reinicia el contenedor para vaciar la ventana (solo local / docker compose).
 */
export async function resetRegistrationRateLimit(): Promise<void> {
  const backendDir = path.resolve(process.cwd(), "../restaurant-backend");
  try {
    // restart vacía el ConcurrentHashMap in-memory (sin rebuild).
    execFileSync("docker", ["compose", "restart", "backend"], {
      cwd: backendDir,
      stdio: "pipe",
      timeout: 120_000,
    });
  } catch (err) {
    throw new Error(
      `No se pudo reiniciar restaurant-backend para limpiar rate limit de registro: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${e2eEnv.apiUrl}/actuator/health`);
      if (res.ok) return;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  throw new Error(
    `Backend no recuperó health tras restart (${e2eEnv.apiUrl}/actuator/health).`,
  );
}
