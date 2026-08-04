import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  MessageSquareWarning,
  QrCode,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { PanelAccessRole } from "@/lib/jwt-payload";

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Si es true, solo coincide la ruta exacta (home de métricas). */
  exact?: boolean;
  /**
   * Roles que pueden ver este ítem.
   * Usa roles canónicos (sin prefijo ROLE_).
   */
  roles: readonly PanelAccessRole[];
}

const ADMIN_ONLY = ["OWNER", "ADMIN"] as const satisfies readonly PanelAccessRole[];
const KITCHEN_ROLES = [
  "OWNER",
  "ADMIN",
  "COCINA",
] as const satisfies readonly PanelAccessRole[];
const WAITER_ROLES = [
  "OWNER",
  "ADMIN",
  "MESERO",
] as const satisfies readonly PanelAccessRole[];

/**
 * Navegación oficial del panel admin, con ACL por rol.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Métricas",
    description: "KPIs, facturación y top platillos",
    icon: BarChart3,
    exact: true,
    roles: ADMIN_ONLY,
  },
  {
    href: "/admin/dashboard/analytics",
    label: "Corte Z",
    description: "Cierre de caja diario y reporte Z",
    icon: BarChart3,
    roles: ADMIN_ONLY,
  },
  {
    href: "/admin/dashboard/kitchen",
    label: "Monitor de Cocina",
    description: "Comandas en vivo (KDS)",
    icon: ChefHat,
    roles: KITCHEN_ROLES,
  },
  {
    href: "/admin/dashboard/orders",
    label: "Gestión de Mesas",
    description: "Mesas, cuentas y cobro",
    icon: ClipboardList,
    roles: WAITER_ROLES,
  },
  {
    href: "/admin/dashboard/feedback",
    label: "Opiniones",
    description: "Inbox de reclamos Smart Rating",
    icon: MessageSquareWarning,
    roles: ADMIN_ONLY,
  },
  {
    href: "/admin/dashboard/qr",
    label: "Códigos QR",
    description: "Menú y mesas para escanear",
    icon: QrCode,
    roles: ADMIN_ONLY,
  },
  {
    href: "/admin/dashboard/menu",
    label: "Menú",
    description: "Catálogo y platillos",
    icon: UtensilsCrossed,
    roles: ADMIN_ONLY,
  },
  {
    href: "/admin/dashboard/team",
    label: "Mi Equipo",
    description: "Roles y PINs del personal",
    icon: Users,
    roles: ADMIN_ONLY,
  },
  {
    href: "/admin/dashboard/settings",
    label: "Ajustes",
    description: "Marca, horarios y módulos",
    icon: Settings,
    roles: ADMIN_ONLY,
  },
] as const;

export function isAdminNavActive(
  pathname: string,
  item: Pick<AdminNavItem, "href" | "exact">,
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function prettifyTenantSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Deep-link a Cocina con ticket enfocado (`?order=` uuid). */
export function adminKitchenOrderHref(orderUuid: string): string {
  return `/admin/dashboard/kitchen?order=${encodeURIComponent(orderUuid)}`;
}
