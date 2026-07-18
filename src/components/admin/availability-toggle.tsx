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
          : "bg-neutral-200/90 dark:bg-neutral-700/80"
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
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide transition disabled:cursor-default ${
          isAvailable
            ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
            : "text-black/40 hover:text-black/70 disabled:opacity-100 dark:text-white/35 dark:hover:text-white/70"
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
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide transition disabled:cursor-default ${
          !isAvailable
            ? "bg-neutral-800 text-white shadow-sm dark:bg-neutral-200 dark:text-neutral-900"
            : "text-black/40 hover:text-black/70 disabled:opacity-100 dark:text-white/35 dark:hover:text-white/70"
        } ${busy && isAvailable ? "animate-pulse" : ""}`}
      >
        {busy ? "…" : "Agotado"}
      </button>
    </div>
  );
}
