"use client";

/**
 * Marca del local en la puerta de acceso admin.
 * Logo remoto con fallback a inicial si falla la carga.
 */

import { useState } from "react";

interface AdminLoginBrandProps {
  restaurantName: string;
  logoUrl?: string | null;
}

function BrandMark({
  restaurantName,
  logoUrl,
}: {
  restaurantName: string;
  logoUrl: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  if (showLogo && logoUrl) {
    return (
      // Host remoto arbitrario del tenant.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`Logo de ${restaurantName}`}
        width={64}
        height={64}
        sizes="64px"
        decoding="async"
        fetchPriority="high"
        onError={() => setLogoFailed(true)}
        className="size-16 shrink-0 rounded-2xl bg-secondary object-cover ring-1 ring-border aspect-square"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-live-muted text-2xl font-bold tracking-tight text-live-ink"
    >
      {restaurantName.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function AdminLoginBrand({
  restaurantName,
  logoUrl = null,
}: AdminLoginBrandProps) {
  return (
    <header className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-live-ink">
        PlatoListo
      </p>
      <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <BrandMark restaurantName={restaurantName} logoUrl={logoUrl} />
        <div className="min-w-0 self-center text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-balance [overflow-wrap:anywhere] sm:text-4xl">
            {restaurantName}
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            Acceso a cocina y caja
          </p>
        </div>
      </div>
    </header>
  );
}
