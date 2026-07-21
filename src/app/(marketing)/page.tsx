import type { Metadata } from "next";
import { SaasLanding } from "@/components/marketing/saas-landing";

export const metadata: Metadata = {
  title: "PlatoListo · Menú digital y cocina en tiempo real",
  description:
    "SaaS multi-tenant para restaurantes: menú QR, monitor de cocina, marca propia y cero comisiones por pedido.",
  openGraph: {
    title: "PlatoListo · Tu restaurante en internet. Cero comisiones.",
    description:
      "Acelera la cocina, multiplica tickets y controla tu marca sin marketplaces.",
    type: "website",
    locale: "es_MX",
    siteName: "PlatoListo",
  },
};

/**
 * Landing global del SaaS (dominio principal sin subdominio).
 * Los websites institucionales viven en `(public)/[tenant]`.
 */
export default function MarketingPage() {
  return <SaasLanding />;
}
