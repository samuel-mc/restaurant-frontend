/**
 * Decodifica el payload de un JWT sin verificar firma.
 * Solo para UI / proxy (routing por rol); el backend sigue siendo la fuente de verdad.
 */

export type JwtPanelRole =
  | "OWNER"
  | "ADMIN"
  | "MESERO"
  | "COCINA"
  | "CASHIER"
  | "KITCHEN"
  | "SUPER_ADMIN"
  | string;

export interface AdminJwtPayload {
  sub?: string;
  role?: JwtPanelRole;
  staffId?: string;
  restaurantId?: number;
  tenantId?: number;
  tokenType?: string;
  impersonatedBy?: string;
  exp?: number;
}

/** Roles canónicos del panel (sin prefijo ROLE_). */
export type PanelAccessRole = "OWNER" | "ADMIN" | "MESERO" | "COCINA";

export function decodeJwtPayload(token: string): AdminJwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as AdminJwtPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Normaliza `ROLE_COCINA` / `KITCHEN` → `COCINA`, etc. */
export function normalizePanelRole(
  role: string | null | undefined,
): PanelAccessRole | null {
  if (!role) return null;
  const raw = role.trim().toUpperCase().replace(/^ROLE_/, "");
  switch (raw) {
    case "OWNER":
      return "OWNER";
    case "ADMIN":
      return "ADMIN";
    case "MESERO":
    case "CASHIER":
      return "MESERO";
    case "COCINA":
    case "KITCHEN":
      return "COCINA";
    default:
      return null;
  }
}

export function extractRoleFromToken(token: string): JwtPanelRole | null {
  const payload = decodeJwtPayload(token);
  const role = payload?.role?.trim();
  return role || null;
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  // Si no podemos leer el claim, no lo tratamos como expirado (evita bucles
  // de redirect al login de staff por un decode fallido en el edge).
  if (!payload || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

/**
 * maxAge de cookie alineado al `exp` del JWT (p. ej. impersonación 30 min),
 * sin superar el tope operativo de sesión admin.
 */
export function cookieMaxAgeSecondsForToken(
  token: string,
  maxCapSeconds: number,
): number {
  const payload = decodeJwtPayload(token);
  const now = Math.floor(Date.now() / 1000);
  if (
    !payload ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return maxCapSeconds;
  }
  const remaining = Math.floor(payload.exp - now);
  if (remaining <= 0) {
    return 0;
  }
  return Math.min(maxCapSeconds, remaining);
}

/** Login de selección de personal (subdominio → rewrite a `[tenant]/staff/login`). */
export const STAFF_LOGIN_PATH = "/staff/login";

/** Home post-login según rol operativo. */
export function homePathForRole(role: string | null | undefined): string {
  const normalized = normalizePanelRole(role);
  switch (normalized) {
    case "COCINA":
      return "/admin/dashboard/kitchen";
    case "MESERO":
      return "/admin/dashboard/orders";
    default:
      return "/admin/dashboard";
  }
}

/**
 * Destino tras cerrar sesión / cambio de turno.
 * Staff PIN → selección de personal; dueño email → login admin.
 */
export function logoutPathForSession(options: {
  role?: string | null;
  tokenType?: string | null;
}): string {
  if (options.tokenType === "staff") return STAFF_LOGIN_PATH;
  const normalized = normalizePanelRole(options.role);
  if (normalized === "MESERO" || normalized === "COCINA") {
    return STAFF_LOGIN_PATH;
  }
  return "/admin/login";
}

/**
 * Si el rol no puede visitar `pathname`, devuelve la ruta de redirección.
 * `null` = permitido.
 */
export function redirectIfRoleForbidden(
  role: string | null | undefined,
  pathname: string,
): string | null {
  const normalized = normalizePanelRole(role);
  if (!normalized) return null;

  if (normalized === "COCINA") {
    const allowed =
      pathname === "/admin/dashboard/kitchen" ||
      pathname.startsWith("/admin/dashboard/kitchen/");
    return allowed ? null : "/admin/dashboard/kitchen";
  }

  if (normalized === "MESERO") {
    const allowed =
      pathname === "/admin/dashboard/orders" ||
      pathname.startsWith("/admin/dashboard/orders/");
    return allowed ? null : "/admin/dashboard/orders";
  }

  // ADMIN / OWNER: acceso completo
  return null;
}
