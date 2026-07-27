"use client";

/**
 * WAI-ARIA Tabs: flechas + Home/End con activación automática (focus → click).
 * Conserva aceleradores externos (p. ej. 1–4 en Cocina).
 */

import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type TablistOrientation = "horizontal" | "vertical";

function getTabs(tablist: HTMLElement): HTMLElement[] {
  return Array.from(
    tablist.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
  );
}

export function useRovingTablist(
  orientation: TablistOrientation = "horizontal",
) {
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const tablist = event.currentTarget;
      const tabs = getTabs(tablist);
      if (tabs.length === 0) return;

      const currentIndex = tabs.findIndex((tab) => tab === event.target);
      if (currentIndex < 0) return;

      const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

      let nextIndex: number | null = null;
      if (event.key === prevKey) {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === nextKey) {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const tab = tabs[nextIndex];
      tab.focus();
      tab.click();
    },
    [orientation],
  );

  return {
    onKeyDown,
    orientation,
  };
}
