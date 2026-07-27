"use client";

import type { ReactNode } from "react";
import {
  useRovingOptionGroup,
} from "@/hooks/useRovingOptionGroup";
import type { TablistOrientation } from "@/hooks/useRovingTablist";

interface AdminOptionGroupProps {
  "aria-label": string;
  orientation?: TablistOrientation;
  className?: string;
  children: ReactNode;
}

/**
 * Grupo de opciones exclusivas (filtros, periodos, modos).
 * Teclado: flechas / Home / End. No usa role=tablist.
 */
export function AdminOptionGroup({
  "aria-label": ariaLabel,
  orientation = "horizontal",
  className,
  children,
}: AdminOptionGroupProps) {
  const { onKeyDown } = useRovingOptionGroup(orientation);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={className}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
