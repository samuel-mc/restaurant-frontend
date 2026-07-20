import { Nunito_Sans, Pinyon_Script, Playfair_Display } from "next/font/google";

/**
 * Fuentes de la plantilla de landing (Playfair / Nunito / Pinyon).
 * Self-hosted vía next/font para evitar depender de @import remoto.
 */
export const fontPlayfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const fontNunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});

export const fontPinyon = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pinyon",
  display: "swap",
});

/** Clases CSS variables para `<html>`. */
export const landingFontVariables = [
  fontPlayfair.variable,
  fontNunito.variable,
  fontPinyon.variable,
].join(" ");
