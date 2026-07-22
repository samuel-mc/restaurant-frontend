"use client";

/**
 * Shell oscuro del SuperAdmin (estilo Vercel/Linear).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { clearSuperAdminToken } from "@/services/superadminService";

const NAV = [
  { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/superadmin/tenants", label: "Tenants", icon: Building2, exact: false },
  { href: "/superadmin/billing", label: "Billing", icon: CreditCard, exact: false },
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
    <div className="flex min-h-screen bg-[#0A0A0B] text-zinc-100">
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#111113] md:flex">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            PlatoListo
          </p>
          <h1 className="mt-1 text-sm font-semibold tracking-tight text-white">
            SuperAdmin
          </h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="SuperAdmin">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                }`}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-red-300 disabled:opacity-50"
          >
            <LogOut className="size-4" />
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0A0B]/95 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              SuperAdmin
            </p>
            <p className="text-sm font-semibold text-white">PlatoListo</p>
          </div>
          <button
            type="button"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg border border-white/10 p-2 text-zinc-300"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </header>

        {mobileOpen ? (
          <div className="border-b border-white/[0.06] bg-[#111113] px-3 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      active ? "bg-white/[0.08] text-white" : "text-zinc-400"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-300"
              >
                Cerrar sesión
              </button>
            </nav>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
