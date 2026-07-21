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

/** Payload de alta/edición con archivo opcional (R2-ready / multipart). */
export interface ProductFormSubmitPayload {
  name: string;
  description: string | null;
  price: number;
  categoryId: number;
  /** Archivo binario; si existe se envía como FormData. */
  imageFile: File | null;
  /** URL previa al editar sin cambiar imagen. */
  existingImageUrl?: string | null;
}

function toCategory(dto: CategoryResponse): Category {
  return {
    id: dto.id,
    name: dto.name,
    displayOrder: dto.displayOrder,
    createdAt: dto.createdAt,
  };
}

function buildProductFormData(payload: ProductFormSubmitPayload): FormData {
  const formData = new FormData();
  formData.append("name", payload.name);
  if (payload.description) {
    formData.append("description", payload.description);
  }
  formData.append("price", String(payload.price));
  formData.append("categoryId", String(payload.categoryId));
  if (payload.imageFile) {
    formData.append("image", payload.imageFile);
  }
  return formData;
}

async function bffFetch(
  path: string,
  tenantSlug: string,
  init: RequestInit,
): Promise<Response> {
  const slug = resolveTenantSlug(tenantSlug);
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  return fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      // FormData: no fijar Content-Type (boundary automático).
      ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
      "x-tenant-slug": slug,
      ...(init.headers ?? {}),
    },
    credentials: "same-origin",
  });
}

function catalogErrorMessage(
  body: { error?: string } | null,
  fallback: string,
): string {
  if (body && typeof body === "object" && body.error) {
    return String(body.error);
  }
  return fallback;
}

async function bffJson<T>(
  path: string,
  tenantSlug: string,
  init: RequestInit,
): Promise<T> {
  const response = await bffFetch(path, tenantSlug, init);

  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new ApiError({
      message: catalogErrorMessage(
        body && typeof body === "object" && "error" in body
          ? (body as { error?: string })
          : null,
        "No se pudo completar la operación del catálogo.",
      ),
      status: response.status,
      statusText: response.statusText,
      url: path,
      body,
    });
  }

  return body as T;
}

/** DELETE / mutaciones sin cuerpo (p. ej. 204 No Content). */
async function bffVoid(
  path: string,
  tenantSlug: string,
  init: RequestInit,
): Promise<void> {
  const response = await bffFetch(path, tenantSlug, init);

  if (response.status === 204 || response.status === 205) {
    return;
  }

  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new ApiError({
      message: catalogErrorMessage(
        body,
        "No se pudo completar la operación del catálogo.",
      ),
      status: response.status,
      statusText: response.statusText,
      url: path,
      body,
    });
  }
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

export async function updateCategory(
  id: number,
  data: CategoryRequest,
  tenantSlug: string,
): Promise<Category> {
  const dto = await bffJson<CategoryResponse>(
    `/api/admin/categories/${id}`,
    tenantSlug,
    { method: "PUT", body: JSON.stringify(data) },
  );
  return toCategory(dto);
}

export async function deleteCategory(
  id: number,
  tenantSlug: string,
): Promise<void> {
  await bffVoid(`/api/admin/categories/${id}`, tenantSlug, {
    method: "DELETE",
  });
}

/** Alta con FormData (multipart) cuando hay imagen o siempre en create. */
export async function createProductWithForm(
  payload: ProductFormSubmitPayload,
  tenantSlug: string,
): Promise<Product> {
  const formData = buildProductFormData(payload);
  const dto = await bffJson<ProductResponse>(
    "/api/admin/products",
    tenantSlug,
    { method: "POST", body: formData },
  );
  return toProduct(dto);
}

/** Edición: multipart si hay archivo nuevo; JSON si solo cambian campos. */
export async function updateProductWithForm(
  uuid: string,
  payload: ProductFormSubmitPayload,
  tenantSlug: string,
): Promise<Product> {
  if (payload.imageFile) {
    const formData = buildProductFormData(payload);
    const dto = await bffJson<ProductResponse>(
      `/api/admin/products/${uuid}`,
      tenantSlug,
      { method: "PUT", body: formData },
    );
    return toProduct(dto);
  }

  const json: ProductRequest = {
    name: payload.name,
    description: payload.description,
    price: payload.price,
    categoryId: payload.categoryId,
    imageUrl: payload.existingImageUrl ?? null,
  };

  const dto = await bffJson<ProductResponse>(
    `/api/admin/products/${uuid}`,
    tenantSlug,
    { method: "PUT", body: JSON.stringify(json) },
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

export async function deleteProduct(
  uuid: string,
  tenantSlug: string,
): Promise<void> {
  await bffVoid(`/api/admin/products/${uuid}`, tenantSlug, {
    method: "DELETE",
  });
}
