import type { Metadata } from "next";
import { TermsConditions } from "@/components/marketing/terms-conditions";

export const metadata: Metadata = {
  title: "Términos y Condiciones · PlatoListo",
  description:
    "Términos y condiciones de uso de la plataforma SaaS PlatoListo para restaurantes.",
  openGraph: {
    title: "Términos y Condiciones · PlatoListo",
    description:
      "Condiciones de uso del software PlatoListo: suscripciones, propiedad intelectual y limitación de responsabilidad.",
    type: "website",
    locale: "es_MX",
    siteName: "PlatoListo",
  },
};

/**
 * Documento legal del SaaS (dominio principal).
 */
export default function TerminosPage() {
  return <TermsConditions />;
}
