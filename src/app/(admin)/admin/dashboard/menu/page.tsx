import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MenuManager } from "@/components/admin/menu-manager";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import { getAdminCatalog } from "@/services/adminCatalogQueries";
import { ApiError } from "@/services/apiClient";
import type { Category, Product } from "@/types/api";

export const metadata: Metadata = {
  title: "Menú · Panel",
  description: "Administra categorías, platillos, precios y stock.",
};

/**
 * Módulo Menú — categorías y platillos.
 *
 * Server: snapshot autenticado (JWT HttpOnly + X-Tenant).
 * Client: ABM de platillos y toggle de disponibilidad vía BFF.
 */
export default async function AdminMenuManagementPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold">Tenant no identificado</h1>
        <p className="text-sm text-foreground/60">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  let categories: Category[] = [];
  let products: Product[] = [];
  let loadError: string | null = null;

  try {
    const catalog = await getAdminCatalog(tenantSlug);
    categories = catalog.categories;
    products = catalog.products;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    loadError =
      error instanceof ApiError
        ? error.message
        : "No pudimos cargar el catálogo.";
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold">Catálogo no disponible</h1>
        <p className="text-sm text-foreground/60">{loadError}</p>
      </div>
    );
  }

  return (
    <MenuManager
      tenantSlug={tenantSlug}
      restaurantName={prettifyTenantSlug(tenantSlug)}
      initialCategories={categories}
      initialProducts={products}
    />
  );
}
