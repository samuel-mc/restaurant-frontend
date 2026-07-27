"use client";

/**
 * Barra sticky de categorías.
 * ≤4: chips en fila. ≥5: fila scrolleable + «Más» como salto (cerca → resto).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

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

/** Activa ± vecinos para saltos cortos en «Más». */
function nearbyCategories(
  categories: CategoryTab[],
  activeId: string,
  radius = 1,
): CategoryTab[] {
  if (categories.length === 0) return [];
  const idx = categories.findIndex((category) => category.id === activeId);
  if (idx < 0) return categories.slice(0, Math.min(3, categories.length));
  const start = Math.max(0, idx - radius);
  const end = Math.min(categories.length, idx + radius + 1);
  return categories.slice(start, end);
}

export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: CategoryBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasOverflow = categories.length >= OVERFLOW_AT;

  const nearby = useMemo(
    () => nearbyCategories(categories, activeId),
    [categories, activeId],
  );
  const nearbyIds = useMemo(
    () => new Set(nearby.map((category) => category.id)),
    [nearby],
  );
  const rest = useMemo(
    () => categories.filter((category) => !nearbyIds.has(category.id)),
    [categories, nearbyIds],
  );

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
    const onPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [moreOpen]);

  function selectCategory(id: string) {
    onSelect(id);
    setMoreOpen(false);
  }

  return (
    <nav
      ref={navRef}
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
                  className={`${focusRing} inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors active:scale-[0.98] ${
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
            className={`${focusRing} inline-flex min-h-11 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold text-foreground`}
          >
            Más
            <span className="sr-only"> categorías</span>
          </button>
        ) : null}
      </div>

      {moreOpen && hasOverflow ? (
        <div
          id={moreId}
          className="mt-2 max-h-[40vh] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">
            Cerca
          </p>
          <ul className="flex flex-col gap-0.5">
            {nearby.map((category) => {
              const isActive = category.id === activeId;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => selectCategory(category.id)}
                    aria-pressed={isActive}
                    className={`${focusRing} flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm ${
                      isActive
                        ? "bg-[var(--menu-accent-muted)] font-semibold text-foreground"
                        : "font-medium text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="min-w-0 truncate">{category.name}</span>
                    {isActive ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Actual
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {rest.length > 0 ? (
            <>
              <p className="mt-3 px-2 pb-1.5 text-xs font-medium text-muted-foreground">
                Todas
              </p>
              <ul className="flex flex-col">
                {rest.map((category) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => selectCategory(category.id)}
                      aria-pressed={false}
                      className={`${focusRing} flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground`}
                    >
                      <span className="min-w-0 truncate">{category.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
