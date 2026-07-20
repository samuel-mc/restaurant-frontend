"use client";

/**
 * Shell del panel admin: sidebar izquierda + área de contenido.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import {
  ADMIN_PRIMARY_NAV,
  ADMIN_SECONDARY_NAV,
  isAdminNavActive,
  type AdminNavItem,
} from "@/lib/admin-nav";

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
  const [mobileOpen, setMobileOpen] = useState(false);
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

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
      {/* Desktop / tablet sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-black/5 bg-white md:flex lg:w-64 dark:border-white/10 dark:bg-neutral-900">
        <SidebarBrand restaurantName={restaurantName} tenantSlug={tenantSlug} />
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          <NavSection
            title="Módulos"
            items={ADMIN_PRIMARY_NAV}
            pathname={pathname}
          />
          <NavSection
            title="Cuenta"
            items={ADMIN_SECONDARY_NAV}
            pathname={pathname}
          />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur md:hidden dark:border-white/10 dark:bg-neutral-900/95">
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
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </header>

        {/* Mobile drawer */}
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
              <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
                <NavSection
                  title="Módulos"
                  items={ADMIN_PRIMARY_NAV}
                  pathname={pathname}
                />
                <NavSection
                  title="Cuenta"
                  items={ADMIN_SECONDARY_NAV}
                  pathname={pathname}
                />
              </nav>
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
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

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: readonly AdminNavItem[];
  pathname: string;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isAdminNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                    : "text-neutral-700 hover:bg-black/[0.04] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                }`}
              >
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
    </div>
  );
}
