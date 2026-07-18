/**
 * Mutaciones del catálogo admin vía BFF (JWT HttpOnly).
 */

import type {
  Category,
  CategoryRequest,
  CategoryResponse,
  Product,
  ProductRequest,
  ProductResponse,
} from "@/types/api";
import { toProduct } from "@/lib/product-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

function toCategory(dto: CategoryResponse): Category {
  return {
    id: dto.id,
    name: dto.name,
    displayOrder: dto.displayOrder,
    createdAt: dto.createdAt,
  };
}

async function bffJson<T>(
  path: string,
  tenantSlug: string,
  init: RequestInit,
): Promise<T> {
  const slug = resolveTenantSlug(tenantSlug);
  const hasBody = init.body !== undefined && init.body !== null;
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      "x-tenant-slug": slug,
      ...(init.headers ?? {}),
    },
    credentials: "same-origin",
  });

  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudo completar la operación del catálogo.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url: path,
      body,
    });
  }

  return body as T;
}

export async function createCategory(
  data: CategoryRequest,
  tenantSlug: string,
): Promise<Category> {
  const dto = await bffJson<CategoryResponse>(
    "/api/admin/categories",
    tenantSlug,
    { method: "POST", body: JSON.stringify(data) },
  );
  return toCategory(dto);
}

export async function createProduct(
  data: ProductRequest,
  tenantSlug: string,
): Promise<Product> {
  const dto = await bffJson<ProductResponse>(
    "/api/admin/products",
    tenantSlug,
    { method: "POST", body: JSON.stringify(data) },
  );
  return toProduct(dto);
}

export async function updateProduct(
  uuid: string,
  data: ProductRequest,
  tenantSlug: string,
): Promise<Product> {
  const dto = await bffJson<ProductResponse>(
    `/api/admin/products/${uuid}`,
    tenantSlug,
    { method: "PUT", body: JSON.stringify(data) },
  );
  return toProduct(dto);
}

export async function toggleProductAvailability(
  uuid: string,
  tenantSlug: string,
): Promise<Product> {
  const dto = await bffJson<ProductResponse>(
    `/api/admin/products/${uuid}/toggle-availability`,
    tenantSlug,
    { method: "PATCH" },
  );
  return toProduct(dto);
}
