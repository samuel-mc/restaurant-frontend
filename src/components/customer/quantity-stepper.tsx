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

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  label,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-amber-500/10 p-1">
      <button
        type="button"
        onClick={onDecrement}
        aria-label={`Quitar uno de ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-semibold text-amber-700 shadow-sm transition-transform active:scale-90 dark:bg-neutral-800 dark:text-amber-400"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-6 text-center text-sm font-bold tabular-nums"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Agregar uno de ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-lg font-semibold text-white shadow-sm transition-transform active:scale-90"
      >
        +
      </button>
    </div>
  );
}
