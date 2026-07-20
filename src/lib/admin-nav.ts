import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CookingPot,
  Settings,
  UtensilsCrossed,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Si es true, solo coincide la ruta exacta (home de analíticas). */
  exact?: boolean;
}

export const ADMIN_PRIMARY_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Analíticas",
    description: "KPIs y tendencias",
    icon: BarChart3,
    exact: true,
  },
  {
    href: "/admin/dashboard/kitchen",
    label: "Operación",
    description: "Monitor de cocina",
    icon: CookingPot,
  },
  {
    href: "/admin/dashboard/menu",
    label: "Menú",
    description: "Categorías y platillos",
    icon: UtensilsCrossed,
  },
] as const;

export const ADMIN_SECONDARY_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin/dashboard/settings",
    label: "Ajustes",
    description: "Marca y módulos",
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
