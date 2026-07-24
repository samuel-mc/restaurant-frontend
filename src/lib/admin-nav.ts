import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  QrCode,
  Settings,
  UtensilsCrossed,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Si es true, solo coincide la ruta exacta (home de métricas). */
  exact?: boolean;
}

/**
 * Navegación oficial del panel admin.
 * Orden = flujo operativo: métricas → cocina → pedidos → QR → menú → configuración.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    description: "Métricas y facturación",
    icon: BarChart3,
    exact: true,
  },
  {
    href: "/admin/dashboard/kitchen",
    label: "Cocina en vivo",
    description: "Comandas en tiempo real",
    icon: ChefHat,
  },
  {
    href: "/admin/dashboard/orders",
    label: "Pedidos / Cuentas",
    description: "Listado, cobro y cierre",
    icon: ClipboardList,
  },
  {
    href: "/admin/dashboard/qr",
    label: "Códigos QR",
    description: "Menú y mesas para escanear",
    icon: QrCode,
  },
  {
    href: "/admin/dashboard/menu",
    label: "Menú",
    description: "Catálogo y platillos",
    icon: UtensilsCrossed,
  },
  {
    href: "/admin/dashboard/settings",
    label: "Configuración",
    description: "Marca, horarios y módulos",
    icon: Settings,
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
