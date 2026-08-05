import type { Metadata, Viewport } from "next";
import { landingFontVariables } from "@/lib/fonts";
import { isQa } from "@/lib/app-env";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { ThemeSync } from "@/components/theme-sync";
import "./globals.css";

const qa = isQa();

export const metadata: Metadata = {
  title: qa ? "PlatoListo (QA)" : "PlatoListo",
  description: "SaaS multi-tenant para restaurantes: menú digital y gestión.",
  icons: {
    icon: [{ url: "/brand/pl_favicon.png", type: "image/png" }],
    apple: [{ url: "/brand/pl_favicon.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={landingFontVariables} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
