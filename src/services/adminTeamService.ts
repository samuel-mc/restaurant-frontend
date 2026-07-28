/**
 * Mutaciones cliente del módulo Equipo (vía BFF same-origin).
 */

import type {
  StaffMemberRequest,
  StaffMemberResponse,
  StaffMemberUpdateRequest,
} from "@/types/api";
import { ApiError } from "@/services/apiClient";

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function errorFromResponse(
  response: Response,
  payload: unknown,
  fallback: string,
): ApiError {
  const message =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
      ? (payload as { error: string }).error
      : fallback;
  return new ApiError({
    message,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    body: payload,
  });
}

export async function listTeamMembers(
  tenantSlug: string,
): Promise<StaffMemberResponse[]> {
  const response = await fetch("/api/admin/team", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-tenant-slug": tenantSlug,
    },
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, "No se pudo cargar el equipo.");
  }
  return payload as StaffMemberResponse[];
}

export async function createTeamMember(
  tenantSlug: string,
  body: StaffMemberRequest,
): Promise<StaffMemberResponse> {
  const response = await fetch("/api/admin/team", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-tenant-slug": tenantSlug,
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw errorFromResponse(response, payload, "No se pudo crear el miembro.");
  }
  return payload as StaffMemberResponse;
}

export async function updateTeamMember(
  tenantSlug: string,
  id: string,
  body: StaffMemberUpdateRequest,
): Promise<StaffMemberResponse> {
  const response = await fetch(`/api/admin/team/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-tenant-slug": tenantSlug,
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw errorFromResponse(
      response,
      payload,
      "No se pudo actualizar el miembro.",
    );
  }
  return payload as StaffMemberResponse;
}

export async function deactivateTeamMember(
  tenantSlug: string,
  id: string,
): Promise<void> {
  const response = await fetch(`/api/admin/team/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "x-tenant-slug": tenantSlug,
    },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 204) return;
  const payload = await parseJson(response);
  if (!response.ok) {
    throw errorFromResponse(
      response,
      payload,
      "No se pudo desactivar el miembro.",
    );
  }
}
