import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { QrGenerator } from "@/components/admin/qr-generator";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";
import { ApiError } from "@/services/apiClient";

export const metadata: Metadata = {
  title: "Códigos QR · Panel",
  description: "Genera e imprime códigos QR del menú y mesas.",
};

/**
 * Generador de códigos QR para menú general y mesas.
 */
export default async function AdminQrPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Tenant no identificado
        </h1>
        <p className="text-sm text-muted-foreground">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  let restaurantName = prettifyTenantSlug(tenantSlug);
  let logoUrl: string | null = null;
  let primaryColor = "#171717";

  try {
    const profile = await getRestaurantProfile(tenantSlug);
    restaurantName = profile.name || restaurantName;
    logoUrl = profile.logoUrl;
    primaryColor = profile.primaryColor || primaryColor;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    // Seguimos con defaults si el perfil no carga.
  }

  return (
    <QrGenerator
      tenantSlug={tenantSlug}
      restaurantName={restaurantName}
      logoUrl={logoUrl}
      primaryColor={primaryColor}
    />
  );
}
