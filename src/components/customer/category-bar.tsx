"use client";

/**
 * Barra superior horizontal deslizable con las categorías del menú.
 * Fija (sticky) bajo el banner para acceso rápido con el pulgar.
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

export function CategoryBar({ categories, activeId, onSelect }: CategoryBarProps) {
  return (
    <nav
      aria-label="Categorías del menú"
      className="sticky top-0 z-20 -mx-4 border-b border-black/5 bg-background/90 px-4 py-3 backdrop-blur dark:border-white/10"
    >
      <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => {
          const isActive = category.id === activeId;
          return (
            <li key={category.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(category.id)}
                aria-pressed={isActive}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-95 ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
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
