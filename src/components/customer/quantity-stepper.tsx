"use client";

/**
 * Control táctil para ajustar cantidades (− valor +).
 * Targets ≥44px para uso con pulgar en mesa.
 */

import { useEffect, useRef, useState } from "react";

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Etiqueta accesible del producto asociado. */
  label: string;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  label,
}: QuantityStepperProps) {
  const prevQuantityRef = useRef(quantity);
  const [quantityBump, setQuantityBump] = useState(false);

  useEffect(() => {
    if (quantity > prevQuantityRef.current) {
      setQuantityBump(true);
      const id = window.setTimeout(() => setQuantityBump(false), 280);
      prevQuantityRef.current = quantity;
      return () => window.clearTimeout(id);
    }
    prevQuantityRef.current = quantity;
  }, [quantity]);

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-[var(--menu-accent-muted)] p-0.5">
      <button
        type="button"
        onClick={onDecrement}
        aria-label={`Quitar uno de ${label}`}
        className={`${focusRing} flex size-11 items-center justify-center rounded-lg bg-card text-lg font-semibold text-foreground transition-transform active:scale-[0.96]`}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`min-w-8 text-center text-sm font-bold tabular-nums ${
          quantityBump ? "cart-count-bump" : ""
        }`}
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Agregar uno de ${label}`}
        className={`${focusRing} flex size-11 items-center justify-center rounded-lg bg-[var(--menu-accent)] text-lg font-semibold text-[var(--menu-accent-fg)] transition-transform active:scale-[0.96]`}
      >
        +
      </button>
    </div>
  );
}
