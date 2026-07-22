import type { Metadata } from "next";
import { B2bLanding } from "@/components/marketing/b2b-landing";

export const metadata: Metadata = {
  title: "PlatoListo · Menú QR, cocina en vivo y cero comisiones",
  description:
    "SaaS multi-tenant para restaurantes: menú QR ultrarrápido, monitor de cocina con WebSockets y canal propio sin comisiones.",
  openGraph: {
    title: "PlatoListo · Tu menú en la mesa. Tu cocina en vivo.",
    description:
      "Transforma tu restaurante con menús QR, comandas en tiempo real y cero comisiones.",
    type: "website",
    locale: "es_MX",
    siteName: "PlatoListo",
  },
};

/**
 * Landing global del SaaS (dominio principal sin subdominio).
 * Diseño: B2B_Landing integrado en Next.js.
 */
export default function MarketingPage() {
  return <B2bLanding />;
}
