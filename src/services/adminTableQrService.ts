/**
 * Firma tokens de QR de mesa vía BFF admin.
 */

import { ApiError } from "@/services/apiClient";

export interface TableQrLink {
  tableNumber: string;
  tableToken: string;
  /** ISO-8601 UTC de caducidad (tokens v2). */
  expiresAt?: string | null;
}

function tenantHeaders(tenantSlug: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-tenant-slug": tenantSlug.trim().toLowerCase(),
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error || data.message || "No se pudieron firmar los QR de mesa.";
  } catch {
    return "No se pudieron firmar los QR de mesa.";
  }
}

/** Firma uno o varios números de mesa (máx. 48). */
export async function signTableQrLinks(
  tenantSlug: string,
  tableNumbers: string[],
): Promise<TableQrLink[]> {
  const response = await fetch("/api/admin/table-qr/sign", {
    method: "POST",
    headers: tenantHeaders(tenantSlug),
    body: JSON.stringify({ tableNumbers }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError({
      message: await readError(response),
      status: response.status,
      statusText: response.statusText,
      url: "/api/admin/table-qr/sign",
    });
  }

  const data = (await response.json()) as { links?: TableQrLink[] };
  return data.links ?? [];
}
