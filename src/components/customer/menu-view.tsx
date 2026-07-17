"use client";

/**
 * Vista interactiva del menú del comensal.
 *
 * Recibe el catálogo ya cargado en el Server Component y gestiona en cliente:
 * - Derivación de categorías (con opción "Todos").
 * - Barra sticky horizontal de categorías.
 * - Feed vertical filtrado de productos.
 * - Barra flotante del carrito + drawer de confirmación.
 */

import { useMemo, useState } from "react";
import type { Product } from "@/types/api";
import {
  CategoryBar,
  type CategoryTab,
} from "@/components/customer/category-bar";
import { ProductCard } from "@/components/customer/product-card";
import { CartBar } from "@/components/customer/cart-bar";

const ALL_CATEGORY_ID = "ALL";

interface MenuViewProps {
  products: Product[];
}

export function MenuView({ products }: MenuViewProps) {
  const categories = useMemo<CategoryTab[]>(() => {
    const seen = new Map<string, string>();
    for (const product of products) {
      const id = String(product.categoryId);
      if (!seen.has(id)) seen.set(id, product.categoryName);
    }
    return [
      { id: ALL_CATEGORY_ID, name: "Todos" },
      ...Array.from(seen, ([id, name]) => ({ id, name })),
    ];
  }, [products]);

  const [activeId, setActiveId] = useState<string>(ALL_CATEGORY_ID);

  const visibleProducts = useMemo(() => {
    if (activeId === ALL_CATEGORY_ID) return products;
    return products.filter((product) => String(product.categoryId) === activeId);
  }, [products, activeId]);

  return (
    <>
      <CategoryBar
        categories={categories}
        activeId={activeId}
        onSelect={setActiveId}
      />

      <section
        aria-label="Platillos del menú"
        className="flex flex-col gap-3 pb-28 pt-4"
      >
        {visibleProducts.length > 0 ? (
          visibleProducts.map((product) => (
            <ProductCard key={product.uuid} product={product} />
          ))
        ) : (
          <p className="rounded-2xl bg-white py-12 text-center text-sm text-black/50 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:text-white/50 dark:ring-white/10">
            No hay platillos en esta categoría por ahora.
          </p>
        )}
      </section>

      <CartBar />
    </>
  );
}
