/**
 * Consultas del catálogo admin (solo servidor).
 */

import "server-only";

import type {
  Category,
  CategoryResponse,
  Product,
  ProductResponse,
} from "@/types/api";
import { formatCurrency } from "@/lib/format";
import { resolveTenantSlug } from "@/lib/tenant";
import { getAdminAuthHeaders } from "@/lib/auth-server";
import { apiClient, ApiError } from "@/services/apiClient";

const TENANT_HEADER = "X-Tenant";
const CATEGORIES_PATH = "/api/v1/admin/categories";
const PRODUCTS_PATH = "/api/v1/admin/products";

function toCategory(dto: CategoryResponse): Category {
  return {
    id: dto.id,
    name: dto.name,
    displayOrder: dto.displayOrder,
    createdAt: dto.createdAt,
  };
}

function toProduct(dto: ProductResponse): Product {
  return {
    uuid: dto.uuid,
    name: dto.name,
    description: dto.description ?? null,
    price: dto.price,
    formattedPrice: formatCurrency(dto.price),
    imageUrl: dto.imageUrl ?? null,
    isAvailable: dto.isAvailable,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    createdAt: dto.createdAt,
  };
}

export interface AdminCatalogSnapshot {
  categories: Category[];
  products: Product[];
}

async function requireAuth(tenantSlug: string, url: string) {
  const slug = resolveTenantSlug(tenantSlug);
  const authHeaders = await getAdminAuthHeaders();
  if (!("Authorization" in authHeaders)) {
    throw new ApiError({
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      status: 401,
      statusText: "Unauthorized",
      url,
    });
  }
  return { slug, authHeaders };
}

/** Carga categorías + productos del tenant para el gestor de menú. */
export async function getAdminCatalog(
  tenantSlug: string,
): Promise<AdminCatalogSnapshot> {
  const { slug, authHeaders } = await requireAuth(
    tenantSlug,
    CATEGORIES_PATH,
  );

  const headers = {
    ...authHeaders,
    [TENANT_HEADER]: slug,
  };

  const [categoriesRaw, productsRaw] = await Promise.all([
    apiClient.get<CategoryResponse[]>(CATEGORIES_PATH, {
      headers,
      cache: "no-store",
    }),
    apiClient.get<ProductResponse[]>(PRODUCTS_PATH, {
      headers,
      cache: "no-store",
    }),
  ]);

  const categories = categoriesRaw
    .map(toCategory)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  const products = productsRaw
    .map(toProduct)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { categories, products };
}

export { toCategory, toProduct };
