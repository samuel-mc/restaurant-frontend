"use client";

/**
 * Grupo exclusivo de opciones (filtros / modos): flechas + Home/End.
 * Usa [data-roving-item]; no es el patrón Tabs (sin tabpanel).
 */

import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TablistOrientation } from "@/hooks/useRovingTablist";

function getOptions(group: HTMLElement): HTMLElement[] {
  return Array.from(
    group.querySelectorAll<HTMLElement>(
      '[data-roving-item]:not([disabled]):not([aria-disabled="true"])',
    ),
  );
}

export function useRovingOptionGroup(
  orientation: TablistOrientation = "horizontal",
) {
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const group = event.currentTarget;
      const options = getOptions(group);
      if (options.length === 0) return;

      const currentIndex = options.findIndex((el) => el === event.target);
      if (currentIndex < 0) return;

      const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

      let nextIndex: number | null = null;
      if (event.key === prevKey) {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      } else if (event.key === nextKey) {
        nextIndex = (currentIndex + 1) % options.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = options.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const option = options[nextIndex];
      option.focus();
      option.click();
    },
    [orientation],
  );

  return { onKeyDown, orientation };
}
