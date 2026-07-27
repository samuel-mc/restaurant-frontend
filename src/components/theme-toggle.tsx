"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getStoredTheme,
  notifyThemeChange,
  setStoredTheme,
  subscribeTheme,
  themePreferenceLabel,
  type ThemePreference,
} from "@/lib/theme";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const className = "size-3.5 shrink-0";
  if (preference === "dark") return <Moon className={className} aria-hidden />;
  if (preference === "system") {
    return <Monitor className={className} aria-hidden />;
  }
  return <Sun className={className} aria-hidden />;
}

export function ThemeToggle({
  compact = false,
  className = "",
}: {
  /** Tres iconos densos (header móvil / menú comensal). */
  compact?: boolean;
  className?: string;
}) {
  const preference = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    () => "light" as ThemePreference,
  );

  function select(value: ThemePreference) {
    setStoredTheme(value);
    applyTheme(value);
    notifyThemeChange();
  }

  return (
    <div
      role="group"
      aria-label="Tema de pantalla"
      className={`grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1 ${
        compact ? "w-auto" : "w-full"
      } ${className}`}
    >
      {THEME_OPTIONS.map(({ value, label }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={`Tema ${label}`}
            aria-label={`Tema ${label}${active ? ", seleccionado" : ""}`}
            onClick={() => select(value)}
            className={`inline-flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-[0.625rem] font-bold tracking-wide transition-colors ${focusRing} ${
              active
                ? "bg-card text-live-ink shadow-[0_1px_0_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground"
            } ${compact ? "min-w-9" : ""}`}
          >
            <ThemeIcon preference={value} />
            {compact ? (
              <span className="sr-only">{label}</span>
            ) : (
              <span>{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
