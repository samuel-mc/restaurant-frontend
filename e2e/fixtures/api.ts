/**
 * Helpers API para smoke E2E (auth admin, QR mesa, liberar mesa).
 */

import { execFileSync } from "node:child_process";
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
): Promise<void> {
  const { status, raw } = await api("/api/v1/admin/restaurants/profile", {
    method: "PUT",
    tenant: e2eEnv.tenantSlug,
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
