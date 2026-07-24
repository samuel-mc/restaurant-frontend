"use client";

/**
 * Shell del panel admin: sidebar persistente + drawer móvil.
 * Navegación oficial: Dashboard, Cocina, Pedidos, QR, Menú, Configuración + logout.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import {
  ADMIN_NAV,
  isAdminNavActive,
  type AdminNavItem,
} from "@/lib/admin-nav";
import { clearToken } from "@/services/authService";

interface AdminShellProps {
  restaurantName: string;
  tenantSlug: string;
  children: ReactNode;
}

export function AdminShell({
  restaurantName,
  tenantSlug,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const drawerTitleId = useId();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await clearToken();
    } catch {
      // Forzamos salida aunque falle la red.
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-black/5 bg-white print:hidden md:flex lg:w-64 dark:border-white/10 dark:bg-neutral-900">
        <SidebarBrand restaurantName={restaurantName} tenantSlug={tenantSlug} />
        <nav
          className="flex flex-1 flex-col overflow-y-auto px-3 py-4"
          aria-label="Navegación del panel"
        >
          <NavList items={ADMIN_NAV} pathname={pathname} />
        </nav>
        <div className="border-t border-black/5 p-3 dark:border-white/10">
          <LogoutButton busy={loggingOut} onClick={handleLogout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur print:hidden md:hidden dark:border-white/10 dark:bg-neutral-900/95">
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-tight">
              {restaurantName}
            </p>
            <p className="truncate text-xs font-medium text-black/45 dark:text-white/45">
              Panel · {tenantSlug}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex size-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10"
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Cerrar menú"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby={drawerTitleId}
              className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-2xl dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-4 dark:border-white/10">
                <div className="min-w-0">
                  <p
                    id={drawerTitleId}
                    className="truncate text-base font-black"
                  >
                    {restaurantName}
                  </p>
                  <p className="truncate text-xs text-black/45 dark:text-white/45">
                    {tenantSlug}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10"
                  aria-label="Cerrar menú"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <nav
                className="flex flex-1 flex-col overflow-y-auto px-3 py-4"
                aria-label="Navegación del panel"
              >
                <NavList items={ADMIN_NAV} pathname={pathname} />
              </nav>
              <div className="border-t border-black/5 p-3 dark:border-white/10">
                <LogoutButton busy={loggingOut} onClick={handleLogout} />
              </div>
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function LogoutButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-neutral-700 transition-colors hover:bg-red-500/10 hover:text-red-700 disabled:opacity-60 dark:text-neutral-200 dark:hover:bg-red-500/15 dark:hover:text-red-300"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
        <LogOut className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight">
          {busy ? "Cerrando sesión…" : "Cerrar sesión"}
        </span>
        <span className="block truncate text-[11px] font-medium leading-tight text-black/40 dark:text-white/40">
          Salir del panel
        </span>
      </span>
    </button>
  );
}

function SidebarBrand({
  restaurantName,
  tenantSlug,
}: {
  restaurantName: string;
  tenantSlug: string;
}) {
  return (
    <div className="border-b border-black/5 px-4 py-5 dark:border-white/10">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">
        PlatoListo
      </p>
      <p className="mt-1 truncate text-lg font-black tracking-tight">
        {restaurantName}
      </p>
      <p className="truncate text-xs font-medium text-black/45 dark:text-white/45">
        {tenantSlug}
      </p>
    </div>
  );
}

function NavList({
  items,
  pathname,
}: {
  items: readonly AdminNavItem[];
  pathname: string;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isAdminNavActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                active
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                  : "text-neutral-700 hover:bg-black/[0.04] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
              }`}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-0 w-1 rounded-full bg-amber-400 dark:bg-amber-500"
                />
              ) : null}
              <span
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? "bg-white/15 dark:bg-black/10"
                    : "bg-black/[0.04] dark:bg-white/[0.06]"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">
                  {item.label}
                </span>
                <span
                  className={`block truncate text-[11px] font-medium leading-tight ${
                    active
                      ? "text-white/70 dark:text-neutral-600"
                      : "text-black/40 dark:text-white/40"
                  }`}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
