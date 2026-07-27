"use client";

/**
 * Barra sticky de categorías.
 * ≤4: chips en fila. >4: fila scrolleable + «Más» con lista completa.
 */

import { useEffect, useId, useRef, useState } from "react";

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

/** Por encima de esto, «Más» evita el muro de chips iguales. */
const OVERFLOW_AT = 5;

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: CategoryBarProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasOverflow = categories.length >= OVERFLOW_AT;

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

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  function selectCategory(id: string) {
    onSelect(id);
    setMoreOpen(false);
  }

  return (
    <nav
      aria-label="Categorías del menú"
      className="sticky top-0 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-2 backdrop-blur-sm"
    >
      <div className="flex items-center gap-1">
        <ul
          ref={listRef}
          className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto overscroll-x-contain scroll-smooth"
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
                  onClick={() => selectCategory(category.id)}
                  aria-pressed={isActive}
                  className={`${focusRing} whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors active:scale-[0.98] ${
                    isActive
                      ? "bg-[var(--menu-accent-muted)] font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              </li>
            );
          })}
        </ul>

        {hasOverflow ? (
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((open) => !open)}
            className={`${focusRing} shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-foreground`}
          >
          Más
            <span className="sr-only"> categorías</span>
          </button>
        ) : null}
      </div>

      {moreOpen && hasOverflow ? (
        <div
          id={moreId}
          className="mt-2 max-h-[40vh] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <ul className="flex flex-col">
            {categories.map((category) => {
              const isActive = category.id === activeId;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => selectCategory(category.id)}
                    aria-pressed={isActive}
                    className={`${focusRing} flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                      isActive
                        ? "bg-[var(--menu-accent-muted)] font-semibold text-foreground"
                        : "font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {category.name}
                    {isActive ? (
                      <span className="text-xs text-muted-foreground">
                        Actual
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
