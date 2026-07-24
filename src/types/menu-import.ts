/**
 * Tipos de carga masiva de menú (Excel/CSV).
 */

import type { Category, Product } from "@/types/api";

export interface MenuImportRowError {
  row: number;
  reason: string;
}

export interface MenuImportResult {
  totalProcesados: number;
  creadosExitosamente: number;
  errores: MenuImportRowError[];
  products: Product[];
  categoriesCreated: Category[];
}

/** Wire response desde Spring (`ProductResponse` / `CategoryResponse`). */
export interface MenuImportResultResponse {
  totalProcesados: number;
  creadosExitosamente: number;
  errores: MenuImportRowError[];
  products: Array<{
    uuid: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    available?: boolean;
    isAvailable?: boolean;
    categoryId: number;
    categoryName: string;
    createdAt: string;
  }>;
  categoriesCreated: Array<{
    id: number;
    name: string;
    displayOrder: number;
    createdAt: string;
  }>;
}
