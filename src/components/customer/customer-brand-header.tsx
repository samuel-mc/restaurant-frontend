"use client";

/**
 * Encabezado de marca compartido (menú QR + tracking).
 * Fill = primaryColor del tenant (con contraste remapeado).
 * Polish: si el logo remoto falla, cae a la inicial.
 */

import { useState } from "react";

interface CustomerBrandHeaderProps {
  restaurantName: string;
  logoUrl?: string | null;
  supportLine?: string | null;
  /** Si hay accent de marca válido del perfil. */
  hasBrandFill?: boolean;
}

function BrandMark({
  restaurantName,
  logoUrl,
  hasBrandFill,
}: {
  restaurantName: string;
  logoUrl: string | null;
  hasBrandFill: boolean;
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
        width={48}
        height={48}
        sizes="48px"
        decoding="async"
        fetchPriority="high"
        onError={() => setLogoFailed(true)}
        className={
          hasBrandFill
            ? "size-12 shrink-0 rounded-xl object-cover ring-1 ring-[var(--menu-accent-fg)]/20"
            : "size-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
        }
      />
    );
  }

  return (
    <div
      aria-hidden
      className={
        hasBrandFill
          ? "flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--menu-accent-fg)]/12 text-base font-bold tracking-tight"
          : "flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-bold tracking-tight text-foreground"
      }
    >
      {restaurantName.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function CustomerBrandHeader({
  restaurantName,
  logoUrl = null,
  supportLine = null,
  hasBrandFill = false,
}: CustomerBrandHeaderProps) {
  return (
    <header
      className={
        hasBrandFill
          ? "relative overflow-hidden px-5 pb-5 pt-7 text-[var(--menu-accent-fg)]"
          : "border-b border-border bg-card px-5 pb-5 pt-7"
      }
      style={
        hasBrandFill
          ? {
              backgroundColor: "var(--menu-accent)",
            }
          : undefined
      }
    >
      {hasBrandFill ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(100% 70% at 100% 0%, color-mix(in srgb, var(--menu-accent-soft) 40%, transparent), transparent 60%)",
          }}
        />
      ) : null}

      <div className="relative flex items-center gap-3">
        <BrandMark
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          hasBrandFill={hasBrandFill}
        />
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight">
            {restaurantName}
          </h1>
          {supportLine ? (
            <p
              className={
                hasBrandFill
                  ? "mt-0.5 line-clamp-2 text-sm leading-snug text-[var(--menu-accent-fg)]"
                  : "mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground"
              }
            >
              {supportLine}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
