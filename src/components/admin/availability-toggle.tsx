"use client";

/**
 * Control segmentado de disponibilidad (stock rápido).
 * Una sola superficie: el estado y la acción viven juntos.
 */

interface AvailabilityToggleProps {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  /** Nombre del platillo, para aria-label. */
  productName: string;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function AvailabilityToggle({
  checked,
  disabled = false,
  busy = false,
  onChange,
  productName,
}: AvailabilityToggleProps) {
  const isAvailable = checked;

  return (
    <div
      role="group"
      aria-label={`Disponibilidad de ${productName}`}
      className={`inline-flex rounded-full p-0.5 ${
        isAvailable
          ? "bg-emerald-500/15 dark:bg-emerald-400/15"
          : "bg-secondary"
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={isAvailable}
        disabled={disabled || busy || isAvailable}
        onClick={() => {
          if (!isAvailable) onChange();
        }}
        className={`rounded-full px-2.5 py-1.5 text-xs font-bold tracking-wide transition disabled:cursor-default ${focusRing} ${
          isAvailable
            ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
            : "text-muted-foreground hover:text-foreground disabled:opacity-100"
        } ${busy && !isAvailable ? "animate-pulse" : ""}`}
      >
        En menú
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!isAvailable}
        disabled={disabled || busy || !isAvailable}
        onClick={() => {
          if (isAvailable) onChange();
        }}
        className={`rounded-full px-2.5 py-1.5 text-xs font-bold tracking-wide transition disabled:cursor-default ${focusRing} ${
          !isAvailable
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground disabled:opacity-100"
        } ${busy && isAvailable ? "animate-pulse" : ""}`}
      >
        {busy ? "…" : "Agotado"}
      </button>
    </div>
  );
}
