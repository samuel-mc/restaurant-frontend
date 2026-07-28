"use client";

/**
 * Barra sticky de categorías.
 * ≤4: todas en fila. ≥5: un solo control (activa · N de M ▾) abre la lista completa.
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

/** Por encima de esto, un picker reemplaza la fila de chips. */
const OVERFLOW_AT = 5;

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function categoryIndex(categories: CategoryTab[], id: string): number {
  const idx = categories.findIndex((category) => category.id === id);
  return idx >= 0 ? idx : 0;
}

export function CategoryBar({
  categories,
  activeId,
  onSelect,
}: CategoryBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pickerNudge, setPickerNudge] = useState(false);
  const hasOverflow = categories.length >= OVERFLOW_AT;
  const nudgedForOverflowRef = useRef(false);

  const activeCategory = useMemo(
    () =>
      categories.find((category) => category.id === activeId) ??
      categories[0],
    [categories, activeId],
  );

  const activePosition = useMemo(
    () => categoryIndex(categories, activeId) + 1,
    [categories, activeId],
  );

  // Nudge solo al descubrir el picker (≥5), no en cada scroll de categoría.
  useEffect(() => {
    if (!hasOverflow) {
      setMoreOpen(false);
      nudgedForOverflowRef.current = false;
      setPickerNudge(false);
      return;
    }
    if (nudgedForOverflowRef.current) return;
    nudgedForOverflowRef.current = true;
    setPickerNudge(true);
    const id = window.setTimeout(() => setPickerNudge(false), 480);
    return () => window.clearTimeout(id);
  }, [hasOverflow]);

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
      className="sticky top-0 z-20 -mx-4 border-b border-[color-mix(in_srgb,var(--menu-accent)_18%,var(--border))] bg-[color-mix(in_srgb,var(--menu-accent-wash)_92%,transparent)] px-4 py-2 backdrop-blur-sm"
    >
      {hasOverflow && activeCategory ? (
        <>
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? moreId : undefined}
            aria-haspopup="listbox"
            className={`${focusRing} flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border border-[color-mix(in_srgb,var(--menu-accent)_22%,var(--border))] bg-card px-3 py-1.5 text-left active:scale-[0.99] ${
              pickerNudge && !moreOpen ? "more-nudge" : ""
            }`}
          >
            <span className="min-w-0 truncate text-sm">
              <span className="font-semibold text-foreground">
                {activeCategory.name}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {activePosition} de {categories.length}
              </span>
            </span>
            <span
              aria-hidden
              className={`shrink-0 text-xs font-medium text-muted-foreground ${
                moreOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
            <span className="sr-only">Ver todas las categorías</span>
          </button>

          {moreOpen ? (
            <div
              id={moreId}
              role="listbox"
              aria-label="Categorías del menú"
              className="mt-2 max-h-[40vh] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            >
              <ul className="flex flex-col">
                {categories.map((category) => {
                  const isActive = category.id === activeId;
                  return (
                    <li key={category.id} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => selectCategory(category.id)}
                        aria-controls={`cat-${category.id}`}
                        className={`${focusRing} flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm ${
                          isActive
                            ? "bg-[var(--menu-accent-muted)] font-semibold text-foreground"
                            : "font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
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
            </div>
          ) : null}
        </>
      ) : (
        <ul className="flex flex-wrap items-center gap-0.5">
          {categories.map((category) => {
            const isActive = category.id === activeId;
            return (
              <li key={category.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => selectCategory(category.id)}
                  aria-pressed={isActive}
                  aria-controls={`cat-${category.id}`}
                  className={`${focusRing} inline-flex min-h-11 max-w-[9.5rem] items-center rounded-lg px-3 text-sm transition-colors active:scale-[0.98] ${
                    isActive
                      ? "bg-[var(--menu-accent-muted)] font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:text-foreground"
                  }`}
                  title={category.name}
                >
                  <span className="truncate">{category.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
