import type { Metadata, Viewport } from "next";
import { landingFontVariables } from "@/lib/fonts";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { ThemeSync } from "@/components/theme-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlatoListo",
  description: "SaaS multi-tenant para restaurantes: menú digital y gestión.",
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
      {/* impeccable-live-start */}
<script src="http://localhost:8400/live.js?token=363292a5-a00f-4116-984e-6b9326fb2aa5"></script>
{/* impeccable-live-end */}
</body>
    </html>
  );
}
