import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { prettifyTenantSlug } from "@/lib/admin-nav";
import { getAdminAccessToken } from "@/lib/auth-server";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";
import { ApiError } from "@/services/apiClient";
import type { RestaurantProfile } from "@/types/api";

export const metadata: Metadata = {
  title: "Configuración · Panel",
  description: "Configura la identidad de marca, horarios y módulos activos.",
};

/**
 * Configuración de identidad de marca, horarios y módulos.
 */
export default async function AdminSettingsPage() {
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

  let profile: RestaurantProfile | null = null;
  let loadError: string | null = null;

  try {
    profile = await getRestaurantProfile(tenantSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/admin/login");
    }
    loadError =
      error instanceof ApiError
        ? error.message
        : "No pudimos cargar la configuración.";
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Configuración no disponible
        </h1>
        <p className="text-sm text-muted-foreground">
          {loadError ?? "Perfil no encontrado."}
        </p>
      </div>
    );
  }

  return (
    <SettingsForm
      tenantSlug={tenantSlug}
      restaurantName={profile.name || prettifyTenantSlug(tenantSlug)}
      initialProfile={profile}
    />
  );
}
