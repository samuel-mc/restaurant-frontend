/**
 * Descarga de plantilla e importación masiva de menú vía BFF.
 */

import type {
  MenuImportResult,
  MenuImportResultResponse,
} from "@/types/menu-import";
import { toProduct } from "@/lib/product-mapper";
import { resolveTenantSlug } from "@/lib/tenant";
import { ApiError } from "@/services/apiClient";

const TEMPLATE_PATH = "/api/admin/menu/template";
const UPLOAD_PATH = "/api/admin/menu/upload-excel";

function toImportResult(dto: MenuImportResultResponse): MenuImportResult {
  return {
    totalProcesados: dto.totalProcesados,
    creadosExitosamente: dto.creadosExitosamente,
    errores: Array.isArray(dto.errores) ? dto.errores : [],
    products: (dto.products ?? []).map((raw) =>
      toProduct({
        uuid: raw.uuid,
        name: raw.name,
        description: raw.description,
        price: raw.price,
        imageUrl: raw.imageUrl,
        available: raw.available ?? raw.isAvailable ?? true,
        categoryId: raw.categoryId,
        categoryName: raw.categoryName,
        createdAt: raw.createdAt,
      }),
    ),
    categoriesCreated: (dto.categoriesCreated ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.displayOrder,
      createdAt: c.createdAt,
    })),
  };
}

/** Descarga la plantilla Excel y dispara el save-as del navegador. */
export async function downloadMenuExcelTemplate(
  tenantSlug: string,
): Promise<void> {
  const slug = resolveTenantSlug(tenantSlug);
  const response = await fetch(TEMPLATE_PATH, {
    method: "GET",
    headers: {
      Accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError({
      message: body?.error || "No se pudo descargar la plantilla.",
      status: response.status,
      statusText: response.statusText,
      url: TEMPLATE_PATH,
      body,
    });
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla_menu_platolisto.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Sube .xlsx / .csv y retorna el resumen de importación. */
export async function uploadMenuExcel(
  file: File,
  tenantSlug: string,
): Promise<MenuImportResult> {
  const slug = resolveTenantSlug(tenantSlug);
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(UPLOAD_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "x-tenant-slug": slug,
    },
    credentials: "same-origin",
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as
    | MenuImportResultResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : "No se pudo importar el menú.";
    throw new ApiError({
      message,
      status: response.status,
      statusText: response.statusText,
      url: UPLOAD_PATH,
      body,
    });
  }

  return toImportResult(body as MenuImportResultResponse);
}
