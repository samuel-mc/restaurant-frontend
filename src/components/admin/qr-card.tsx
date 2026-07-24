"use client";

/**
 * Tarjeta estilo acrílico de mesa con QR de alta resolución.
 */

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export interface QrCardProps {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  /** URL embebida en el QR. */
  menuUrl: string;
  /** Texto bajo el QR: "Mesa 4" o "Pide desde tu lugar". */
  headline: string;
  /** id estable para captura PNG / impresión. */
  cardId: string;
  /** Tamaño del QR en px (alta resolución por defecto). */
  qrSize?: number;
  /** Clases extra (p. ej. tamaño en hoja de impresión). */
  className?: string;
}

export const QrCard = forwardRef<HTMLDivElement, QrCardProps>(
  function QrCard(
    {
      restaurantName,
      logoUrl,
      primaryColor = "#171717",
      menuUrl,
      headline,
      cardId,
      qrSize = 200,
      className = "",
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        id={cardId}
        data-qr-card={cardId}
        className={`qr-acrylic-card relative flex w-full flex-col items-center gap-4 overflow-visible rounded-[1.75rem] border border-black/10 bg-white px-5 pb-6 pt-5 text-neutral-950 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] ${className}`}
        style={{ ["--qr-brand" as string]: primaryColor }}
      >
        {/* Guías de corte (solo impresión) */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-px -top-px hidden h-3 w-3 border-l-2 border-t-2 border-neutral-400 print:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-px -top-px hidden h-3 w-3 border-r-2 border-t-2 border-neutral-400 print:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-px -left-px hidden h-3 w-3 border-b-2 border-l-2 border-neutral-400 print:block"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-px -right-px hidden h-3 w-3 border-b-2 border-r-2 border-neutral-400 print:block"
        />

        <header className="flex w-full shrink-0 flex-col items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-11 w-auto max-w-[70%] object-contain"
              crossOrigin="anonymous"
            />
          ) : (
            <div
              className="flex size-11 items-center justify-center rounded-2xl text-lg font-black text-white"
              style={{ backgroundColor: primaryColor }}
              aria-hidden
            >
              {restaurantName.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="max-w-full truncate text-center text-sm font-extrabold tracking-tight">
            {restaurantName}
          </p>
        </header>

        <div className="flex shrink-0 items-center justify-center">
          <div className="rounded-2xl bg-white p-2 ring-1 ring-black/5">
            <QRCodeSVG
              value={menuUrl}
              size={qrSize}
              level="H"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#0a0a0a"
              title={`QR ${headline}`}
            />
          </div>
        </div>

        <footer className="flex w-full shrink-0 flex-col items-center gap-1.5 text-center">
          <p
            className="text-xl font-black tracking-tight"
            style={{ color: primaryColor }}
          >
            {headline}
          </p>
          <p className="max-w-[15rem] text-[11px] font-medium leading-snug text-neutral-500">
            Escanea con la cámara de tu celular para ver el menú y ordenar
          </p>
        </footer>
      </div>
    );
  },
);
