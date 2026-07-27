"use client";

import type { ReactNode } from "react";
import {
  useRovingTablist,
  type TablistOrientation,
} from "@/hooks/useRovingTablist";

interface AdminRovingTablistProps {
  "aria-label": string;
  orientation?: TablistOrientation;
  className?: string;
  children: ReactNode;
}

/**
 * Contenedor tablist con teclado ARIA (flechas / Home / End).
 */
export function AdminRovingTablist({
  "aria-label": ariaLabel,
  orientation = "horizontal",
  className,
  children,
}: AdminRovingTablistProps) {
  const { onKeyDown } = useRovingTablist(orientation);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={className}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
