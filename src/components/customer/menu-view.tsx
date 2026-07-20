"use client";

/**
 * Vista interactiva del menú del comensal.
 *
 * Recibe el catálogo ya cargado en el Server Component y gestiona en cliente:
 * - Derivación de categorías y agrupación de productos.
 * - Barra sticky horizontal con scroll-spy al navegar el feed.
 * - Feed vertical por secciones (scroll automático al tocar una categoría).
 * - Barra flotante del carrito + drawer de confirmación.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/types/api";
import {
  CategoryBar,
  type CategoryTab,
} from "@/components/customer/category-bar";
import { ProductCard } from "@/components/customer/product-card";
import { CartBar, type OrderModules } from "@/components/customer/cart-bar";

interface MenuSection {
  id: string;
  name: string;
  products: Product[];
}

interface MenuViewProps {
  products: Product[];
  /** Slug del restaurante para crear el pedido en el tenant correcto. */
  tenantSlug: string;
  /** Módulos activos (pickup / delivery) desde el perfil público. */
  modules?: OrderModules;
}

export function MenuView({ products, tenantSlug, modules }: MenuViewProps) {
  const sections = useMemo<MenuSection[]>(() => {
    const byCategory = new Map<string, MenuSection>();
    for (const product of products) {
      const id = String(product.categoryId);
      const existing = byCategory.get(id);
      if (existing) {
        existing.products.push(product);
      } else {
        byCategory.set(id, {
          id,
          name: product.categoryName,
          products: [product],
        });
      }
    }
    return Array.from(byCategory.values());
  }, [products]);

  const categories = useMemo<CategoryTab[]>(
    () => sections.map(({ id, name }) => ({ id, name })),
    [sections],
  );

  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const scrollingToRef = useRef<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Scroll-spy: marca la categoría visible mientras el usuario desliza el feed.
  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToRef.current) return;

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );

        const top = visible[0];
        if (top?.target.id) {
          setActiveId(top.target.id.replace(/^cat-/, ""));
        }
      },
      {
        // Compensa la barra sticky de categorías (~56px) + un margen de lectura.
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0, 0.25, 0.5],
      },
    );

    for (const section of sections) {
      const el = sectionRefs.current.get(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  function handleSelectCategory(id: string) {
    setActiveId(id);
    scrollingToRef.current = id;

    const el = sectionRefs.current.get(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });

    // Libera el spy tras el scroll programático.
    window.setTimeout(() => {
      if (scrollingToRef.current === id) scrollingToRef.current = null;
    }, 600);
  }

  return (
    <>
      <CategoryBar
        categories={categories}
        activeId={activeId}
        onSelect={handleSelectCategory}
      />

      <div
        aria-label="Platillos del menú"
        className="flex flex-col gap-8 pb-28 pt-4"
      >
        {sections.map((section) => (
          <section
            key={section.id}
            id={`cat-${section.id}`}
            ref={(node) => {
              if (node) sectionRefs.current.set(section.id, node);
              else sectionRefs.current.delete(section.id);
            }}
            // Offset para que el título no quede bajo la barra sticky.
            className="scroll-mt-20"
            aria-labelledby={`heading-${section.id}`}
          >
            <h2
              id={`heading-${section.id}`}
              className="mb-3 px-0.5 text-sm font-bold uppercase tracking-wider text-black/45 dark:text-white/45"
            >
              {section.name}
            </h2>
            <ul className="flex flex-col gap-3">
              {section.products.map((product) => (
                <li key={product.uuid}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <CartBar tenantSlug={tenantSlug} modules={modules} />
    </>
  );
}
