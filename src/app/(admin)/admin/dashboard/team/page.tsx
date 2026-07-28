import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TeamManager } from "@/components/admin/team-manager";
import { getAdminAccessToken } from "@/lib/auth-server";
import {
  extractRoleFromToken,
  homePathForRole,
  normalizePanelRole,
  STAFF_LOGIN_PATH,
} from "@/lib/jwt-payload";
import { getTeamMembers } from "@/services/adminTeamQueries";
import { ApiError } from "@/services/apiClient";
import type { StaffMemberResponse } from "@/types/api";

export const metadata: Metadata = {
  title: "Equipo · Panel",
  description: "Gestiona roles y PINs del personal del restaurante.",
};

export default async function AdminTeamPage() {
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
    redirect(STAFF_LOGIN_PATH);
  }

  const role = normalizePanelRole(extractRoleFromToken(token));
  if (role === "COCINA" || role === "MESERO") {
    redirect(homePathForRole(role));
  }

  let members: StaffMemberResponse[] = [];
  let loadError: string | null = null;

  try {
    members = await getTeamMembers(tenantSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(STAFF_LOGIN_PATH);
    }
    if (error instanceof ApiError && error.status === 403) {
      redirect("/admin/dashboard");
    }
    loadError =
      error instanceof ApiError
        ? error.message
        : "No pudimos cargar el equipo.";
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Equipo no disponible
        </h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  return <TeamManager tenantSlug={tenantSlug} initialMembers={members} />;
}
