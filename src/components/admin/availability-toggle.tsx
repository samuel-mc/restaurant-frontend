"use client";

/**
 * Toggle de disponibilidad (stock rápido) con estado de carga.
 */

interface AvailabilityToggleProps {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  label: string;
}

export function AvailabilityToggle({
  checked,
  disabled = false,
  busy = false,
  onChange,
  label,
}: AvailabilityToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed ${
        checked
          ? "bg-emerald-500"
          : "bg-neutral-300 dark:bg-neutral-600"
      } ${busy ? "opacity-70" : ""}`}
    >
      <span
        aria-hidden
        className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        } ${busy ? "animate-pulse" : ""}`}
      />
    </button>
  );
}
