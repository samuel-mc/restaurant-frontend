"use client";

/**
 * Shell del SuperAdmin — canvas oscuro operativo PlatoListo.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Ticket,
  X,
} from "lucide-react";
import { clearSuperAdminToken } from "@/services/superadminService";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { saFocus } from "@/components/superadmin/superadmin-ui";
import { QaEnvBadge } from "@/components/env-qa-badge";

const NAV = [
  { href: "/superadmin", label: "Panel", icon: LayoutDashboard, exact: true },
  {
    href: "/superadmin/tenants",
    label: "Restaurantes",
    icon: Building2,
    exact: false,
  },
  {
    href: "/superadmin/coupons",
    label: "Cupones",
    icon: Ticket,
    exact: false,
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const mobileNavRef = useModalFocusTrap({
    open: mobileOpen,
    onEscape: () => setMobileOpen(false),
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await clearSuperAdminToken();
    } catch {
      // force exit
    } finally {
      router.replace("/superadmin/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <div
      id="superadmin-root"
      className="flex min-h-screen bg-[#0A0A0B] text-zinc-100"
    >
      <a
        href="#superadmin-main"
        className={`sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[80] focus:rounded-xl focus:bg-[#047857] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white ${saFocus}`}
      >
        Saltar al contenido
      </a>
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#111113] md:flex">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            PlatoListo
          </p>
          <h1 className="mt-1 text-sm font-semibold tracking-tight text-white">
            SuperAdmin
          </h1>
        </div>
        <nav
          className="flex flex-1 flex-col gap-1 px-3 py-4"
          aria-label="SuperAdmin"
        >
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${saFocus} ${
                  active
                    ? "bg-emerald-500/10 text-emerald-200"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                }`}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          <QaEnvBadge
            variant="block"
            className="border-amber-400/30 bg-amber-400/10 text-amber-300"
          />
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-red-300 disabled:opacity-50 ${saFocus}`}
          >
            <LogOut className="size-4" aria-hidden />
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0A0B]/95 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              PlatoListo
            </p>
            <p className="text-sm font-semibold text-white">SuperAdmin</p>
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
            aria-controls="superadmin-mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
            className={`inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-zinc-300 ${saFocus}`}
          >
            {mobileOpen ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Menu className="size-4" aria-hidden />
            )}
          </button>
        </header>

        {mobileOpen ? (
          <div
            ref={mobileNavRef}
            id="superadmin-mobile-nav"
            className="border-b border-white/[0.06] bg-[#111113] px-3 py-3 md:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="SuperAdmin móvil">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium ${saFocus} ${
                      active
                        ? "bg-emerald-500/10 text-emerald-200"
                        : "text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
                className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-300 disabled:opacity-50 ${saFocus}`}
              >
                {loggingOut ? "Cerrando…" : "Cerrar sesión"}
              </button>
            </nav>
          </div>
        ) : null}

        <main
          id="superadmin-main"
          className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
