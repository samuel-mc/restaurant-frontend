import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { getAdminAccessToken } from "@/lib/auth-server";
import { getRestaurantProfile } from "@/services/adminRestaurantQueries";
import { ApiError } from "@/services/apiClient";
import type { RestaurantProfile } from "@/types/api";

export const metadata: Metadata = {
  title: "Configuración · Panel",
  description: "Configura la identidad de marca, horarios y módulos activos.",
};

function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Configuración de identidad de marca, horarios y módulos.
 *
 * Server: snapshot autenticado GET `/api/v1/admin/restaurants/profile`.
 * Client: formulario con multipart (logo/banner) vía BFF.
 */
export default async function AdminSettingsPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6">
        <h1 className="text-2xl font-bold">Tenant no identificado</h1>
        <p className="text-sm text-foreground/60">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </main>
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
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6">
        <h1 className="text-2xl font-bold">Configuración no disponible</h1>
        <p className="text-sm text-foreground/60">
          {loadError ?? "Perfil no encontrado."}
        </p>
      </main>
    );
  }

  return (
    <SettingsForm
      tenantSlug={tenantSlug}
      restaurantName={profile.name || prettifyTenant(tenantSlug)}
      initialProfile={profile}
    />
  );
}
