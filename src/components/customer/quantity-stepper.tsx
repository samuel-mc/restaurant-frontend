"use client";

/**
 * Control táctil compacto para ajustar cantidades (− valor +).
 * Reutilizado en la tarjeta de producto y en el resumen del carrito.
 */

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
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-[var(--menu-accent-muted)] p-1">
      <button
        type="button"
        onClick={onDecrement}
        aria-label={`Quitar uno de ${label}`}
        className={`${focusRing} flex size-8 items-center justify-center rounded-lg bg-card text-lg font-semibold text-foreground transition-transform active:scale-90`}
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-7 text-center text-sm font-bold tabular-nums"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Agregar uno de ${label}`}
        className={`${focusRing} flex size-8 items-center justify-center rounded-lg bg-[var(--menu-accent)] text-lg font-semibold text-[var(--menu-accent-fg)] transition-transform active:scale-90`}
      >
        +
      </button>
    </div>
  );
}
