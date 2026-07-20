import type { Metadata } from "next";
import { landingFontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlatoListo",
  description: "SaaS multi-tenant para restaurantes: menú digital y gestión.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={landingFontVariables}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
