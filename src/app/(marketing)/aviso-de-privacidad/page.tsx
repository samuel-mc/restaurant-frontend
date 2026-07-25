import type { Metadata } from "next";
import { PrivacyNotice } from "@/components/marketing/privacy-notice";

export const metadata: Metadata = {
  title: "Aviso de Privacidad · PlatoListo",
  description:
    "Aviso de privacidad de PlatoListo conforme a la LFPDPPP: datos recabados, finalidades, transferencias y derechos ARCO.",
  openGraph: {
    title: "Aviso de Privacidad · PlatoListo",
    description:
      "Tratamiento de datos personales de clientes B2B y comensales en la plataforma PlatoListo.",
    type: "website",
    locale: "es_MX",
    siteName: "PlatoListo",
  },
};

/**
 * Aviso de privacidad del SaaS (dominio principal).
 */
export default function AvisoPrivacidadPage() {
  return <PrivacyNotice />;
}
