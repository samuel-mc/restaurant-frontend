"use client";

/**
 * Barra superior horizontal deslizable con las categorías del menú.
 * Sticky bajo el banner para acceso rápido con el pulgar (mobile-first).
 */

export interface CategoryTab {
  /** Identificador de la categoría (`ALL` para "Todos"). */
  id: string;
  name: string;
}

interface CategoryBarProps {
  categories: CategoryTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: CategoryBarProps) {
  return (
    <nav
      aria-label="Categorías del menú"
      className="sticky top-0 z-20 -mx-4 border-b border-black/5 bg-neutral-50/95 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/95"
    >
      <ul className="no-scrollbar flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5">
        {categories.map((category) => {
          const isActive = category.id === activeId;
          return (
            <li key={category.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(category.id)}
                aria-pressed={isActive}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-all active:scale-95 ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25"
                    : "bg-white text-black/60 ring-1 ring-black/5 dark:bg-neutral-900 dark:text-white/60 dark:ring-white/10"
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
