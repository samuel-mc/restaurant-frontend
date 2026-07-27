"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme, subscribeTheme } from "@/lib/theme";

/** Keeps html.dark in sync when preference is system and OS theme changes. */
export function ThemeSync() {
  useEffect(() => {
    applyTheme(getStoredTheme());
    return subscribeTheme(() => {
      applyTheme(getStoredTheme());
    });
  }, []);

  return null;
}
