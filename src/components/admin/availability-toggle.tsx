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
        isAvailable ? "bg-live-muted" : "bg-secondary"
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
        className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold tracking-wide transition disabled:cursor-default ${focusRing} ${
          isAvailable
            ? "bg-live text-live-foreground shadow-sm"
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
        className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold tracking-wide transition disabled:cursor-default ${focusRing} ${
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
