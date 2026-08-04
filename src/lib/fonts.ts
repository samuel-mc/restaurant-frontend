import {
  Lora,
  Nunito_Sans,
  Pinyon_Script,
  Playfair_Display,
  Plus_Jakarta_Sans,
} from "next/font/google";

/**
 * Fuentes de landings institucionales (Playfair / Nunito / Pinyon / Lora).
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

/** Display de Café de la Fe (landing Pro). */
export const fontLora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

/** Tipografía principal del landing B2B SaaS. */
export const fontJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

/** Clases CSS variables para `<html>`. */
export const landingFontVariables = [
  fontPlayfair.variable,
  fontNunito.variable,
  fontPinyon.variable,
  fontLora.variable,
  fontJakarta.variable,
].join(" ");
