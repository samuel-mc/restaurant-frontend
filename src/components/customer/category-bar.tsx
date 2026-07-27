"use client";

/**
 * Barra sticky de categorías del menú.
 * Al cambiar la categoría activa, centra el chip en vista.
 */

import { useEffect, useRef } from "react";

export interface CategoryTab {
  /** Identificador de la categoría. */
  id: string;
  name: string;
}

interface CategoryBarProps {
  categories: CategoryTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: CategoryBarProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const tab = tabRefs.current.get(activeId);
    const list = listRef.current;
    if (!tab || !list) return;

    const listRect = list.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const offset =
      tabRect.left -
      listRect.left -
      listRect.width / 2 +
      tabRect.width / 2;

    list.scrollBy({ left: offset, behavior: "smooth" });
  }, [activeId]);

  return (
    <nav
      aria-label="Categorías del menú"
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm"
    >
      <ul
        ref={listRef}
        className="no-scrollbar flex gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth"
      >
        {categories.map((category) => {
          const isActive = category.id === activeId;
          return (
            <li key={category.id} className="shrink-0">
              <button
                type="button"
                ref={(node) => {
                  if (node) tabRefs.current.set(category.id, node);
                  else tabRefs.current.delete(category.id);
                }}
                onClick={() => onSelect(category.id)}
                aria-pressed={isActive}
                className={`${focusRing} whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors active:scale-[0.98] ${
                  isActive
                    ? "bg-[var(--menu-accent)] text-[var(--menu-accent-fg)]"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
