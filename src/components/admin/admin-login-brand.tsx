"use client";

/**
 * Marca del local en la puerta de acceso admin / staff.
 * Logo remoto con fallback a inicial si falla la carga.
 */

import { useState } from "react";

interface AdminLoginBrandProps {
  restaurantName: string;
  logoUrl?: string | null;
  /** Subtítulo bajo el nombre del local. */
  description?: string;
  /** Densidad Operate (staff): marca más pequeña, tarea más visible. */
  compact?: boolean;
  /** Descripción de estado (vacío/error) vs tarea activa. */
  descriptionMuted?: boolean;
  /**
   * Chip mínimo (paso PIN): logo + nombre en una línea.
   * Sin eyebrow ni descripción — la tarea vive en el pad.
   */
  chip?: boolean;
}

function BrandMark({
  restaurantName,
  logoUrl,
  size,
}: {
  restaurantName: string;
  logoUrl: string | null;
  size: "chip" | "compact" | "default";
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;
  const box =
    size === "chip"
      ? "size-8 rounded-lg"
      : size === "compact"
        ? "size-11 rounded-xl"
        : "size-16 rounded-2xl";
  const initialType =
    size === "chip"
      ? "text-sm font-bold tracking-tight"
      : size === "compact"
        ? "text-lg font-bold tracking-tight"
        : "text-2xl font-bold tracking-tight";
  const px = size === "chip" ? 32 : size === "compact" ? 44 : 64;

  if (showLogo && logoUrl) {
    return (
      // Host remoto arbitrario del tenant.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={size === "chip" ? "" : `Logo de ${restaurantName}`}
        width={px}
        height={px}
        sizes={`${px}px`}
        decoding="async"
        fetchPriority={size === "chip" ? "low" : "high"}
        onError={() => setLogoFailed(true)}
        className={`${box} shrink-0 bg-secondary object-contain ring-1 ring-border aspect-square ${
          size === "chip" ? "p-0.5" : "p-1"
        }`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-live-muted text-live-ink ${box} ${initialType}`}
    >
      {restaurantName.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function AdminLoginBrand({
  restaurantName,
  logoUrl = null,
  description = "Acceso a cocina y caja",
  compact = false,
  descriptionMuted = false,
  chip = false,
}: AdminLoginBrandProps) {
  if (chip) {
    return (
      <header className="flex min-w-0 items-center gap-2.5">
        <BrandMark
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          size="chip"
        />
        <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-muted-foreground">
          {restaurantName}
        </p>
      </header>
    );
  }

  return (
    <header
      className={`flex flex-col gap-2 ${
        compact
          ? "items-stretch text-left"
          : "items-center gap-3 text-center sm:items-start sm:text-left"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.14em] ${
          compact ? "text-muted-foreground" : "text-live-ink"
        }`}
      >
        PlatoListo
      </p>
      <div
        className={`flex w-full min-w-0 items-center gap-3 ${
          compact ? "" : "flex-col sm:flex-row sm:gap-4"
        }`}
      >
        <BrandMark
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          size={compact ? "compact" : "default"}
        />
        <div className="min-w-0 flex-1 self-center text-left">
          <h1
            className={`font-bold tracking-tight text-balance [overflow-wrap:anywhere] ${
              compact
                ? "text-xl sm:text-2xl"
                : "text-3xl sm:text-4xl text-center sm:text-left"
            }`}
          >
            {restaurantName}
          </h1>
          <p
            className={`mt-1 leading-snug [overflow-wrap:anywhere] ${
              compact
                ? descriptionMuted
                  ? "text-sm text-muted-foreground"
                  : "text-base font-medium text-foreground"
                : "text-sm text-muted-foreground"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
