"use client";

/**
 * Shell del panel admin: sidebar por rol + cambio de turno.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LogOut, Menu, X } from "lucide-react";
import {
  isAdminLeaveBlocked,
  requestAdminLeave,
} from "@/lib/admin-leave-guard";
import { isAdminNavActive, type AdminNavItem } from "@/lib/admin-nav";
import { navItemsForRole } from "@/lib/admin-nav-access";
import { logoutPathForSession } from "@/lib/jwt-payload";
import { clearToken } from "@/services/authService";
import { fetchFeedbackSummary } from "@/services/adminFeedbackService";

interface AdminShellProps {
  restaurantName: string;
  tenantSlug: string;
  /** Rol del JWT (`OWNER` | `ADMIN` | `MESERO` | `COCINA`…). */
  accessRole?: string | null;
  /** `staff` cuando el JWT viene del login por PIN; `impersonation` en soporte. */
  tokenType?: string | null;
  /** Email del SuperAdmin en sesión de soporte. */
  impersonatedBy?: string | null;
  children: ReactNode;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AdminShell({
  restaurantName,
  tenantSlug,
  accessRole = null,
  tokenType = null,
  impersonatedBy = null,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const drawerTitleId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const navItems = navItemsForRole(accessRole);
  const isSupportSession = tokenType === "impersonation";
  const isStaffShift =
    tokenType === "staff" ||
    accessRole === "MESERO" ||
    accessRole === "COCINA" ||
    accessRole === "ROLE_MESERO" ||
    accessRole === "ROLE_COCINA";
  const canSeeFeedbackInbox = navItems.some(
    (item) => item.href === "/admin/dashboard/feedback",
  );
  const [urgentFeedbackCount, setUrgentFeedbackCount] = useState(0);

  useEffect(() => {
    if (!canSeeFeedbackInbox || isSupportSession) return;
    let cancelled = false;

    async function refresh() {
      try {
        const summary = await fetchFeedbackSummary(tenantSlug);
        if (!cancelled) {
          setUrgentFeedbackCount(summary.openUrgentCount ?? 0);
        }
      } catch {
        // Silencioso: el badge no debe romper el panel.
      }
    }

    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [canSeeFeedbackInbox, isSupportSession, pathname, tenantSlug]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    const focusables = drawer
      ? Array.from(
          drawer.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
      : [];

    focusables[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        menuButtonRef.current?.focus();
      }
    };
  }, [mobileOpen]);

  async function performLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const dest = logoutPathForSession({ role: accessRole, tokenType });
    try {
      await clearToken();
    } catch {
      // Forzamos salida aunque falle la red.
    } finally {
      router.replace(dest);
      router.refresh();
      setLoggingOut(false);
    }
  }

  function handleLogout() {
    if (loggingOut) return;
    requestAdminLeave(() => {
      void performLogout();
    });
  }

  return (
    <div className="flex min-h-screen bg-muted font-jakarta-sans text-foreground">
      <a
        href="#admin-main"
        className={`absolute left-4 top-4 z-50 -translate-y-[160%] rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform focus:translate-y-0 ${focusRing}`}
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card print:hidden md:flex lg:w-64">
        <SidebarBrand
          restaurantName={restaurantName}
          tenantSlug={tenantSlug}
          accessRole={accessRole}
        />
        <nav
          className="flex flex-1 flex-col overflow-y-auto px-3 py-3"
          aria-label="Navegación del panel"
        >
          <NavList
            items={navItems}
            pathname={pathname}
            urgentFeedbackCount={urgentFeedbackCount}
          />
        </nav>
        <div className="border-t border-border p-3">
          <LogoutButton
            busy={loggingOut}
            shiftMode={isStaffShift}
            onClick={handleLogout}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isSupportSession ? (
          <div
            role="status"
            className="border-b border-amber-700/30 bg-amber-100 px-4 py-2.5 text-sm text-amber-950 print:hidden"
          >
            <p className="font-semibold tracking-tight">
              Sesión de soporte · solo lectura
            </p>
            <p className="mt-0.5 text-xs text-amber-950/80">
              {impersonatedBy
                ? `Entraste como soporte (${impersonatedBy}). No puedes guardar cambios en este local.`
                : "Entraste como soporte. No puedes guardar cambios en este local."}
            </p>
          </div>
        ) : null}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 print:hidden md:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">
              {restaurantName}
            </p>
            <p className="truncate text-xs font-medium text-muted-foreground">
              Panel · {tenantSlug}
            </p>
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors hover:bg-secondary/80 ${focusRing}`}
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-nav"
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
              ref={drawerRef}
              id="admin-mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-labelledby={drawerTitleId}
              className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-card shadow-[0_16px_40px_rgba(0,0,0,0.28)] motion-safe:animate-[fade-up_0.2s_cubic-bezier(0.16,1,0.3,1)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
                <div className="min-w-0">
                  <p
                    id={drawerTitleId}
                    className="truncate text-base font-bold tracking-tight"
                  >
                    {restaurantName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tenantSlug}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary transition-colors hover:bg-secondary/80 ${focusRing}`}
                  aria-label="Cerrar menú"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <nav
                className="flex flex-1 flex-col overflow-y-auto px-3 py-3"
                aria-label="Navegación del panel"
              >
                <NavList
                  items={navItems}
                  pathname={pathname}
                  urgentFeedbackCount={urgentFeedbackCount}
                />
              </nav>
              <div className="border-t border-border p-3">
                <LogoutButton
                  busy={loggingOut}
                  shiftMode={isStaffShift}
                  onClick={handleLogout}
                />
              </div>
            </aside>
          </div>
        ) : null}

        <main id="admin-main" className="min-w-0 flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

function LogoutButton({
  busy,
  shiftMode,
  onClick,
}: {
  busy: boolean;
  shiftMode: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60 ${focusRing}`}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      <span className="truncate">
        {busy
          ? "Cerrando…"
          : shiftMode
            ? "Cambio de turno"
            : "Cerrar sesión"}
      </span>
    </button>
  );
}

function SidebarBrand({
  restaurantName,
  tenantSlug,
  accessRole,
}: {
  restaurantName: string;
  tenantSlug: string;
  accessRole?: string | null;
}) {
  const roleHint =
    accessRole === "COCINA" || accessRole === "ROLE_COCINA"
      ? "Cocina"
      : accessRole === "MESERO" || accessRole === "ROLE_MESERO"
        ? "Mesero"
        : null;

  return (
    <div className="border-b border-border px-4 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-live-ink">
        PlatoListo
      </p>
      <p className="mt-1.5 truncate text-base font-bold tracking-tight">
        {restaurantName}
      </p>
      <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
        {roleHint ? `${roleHint} · ${tenantSlug}` : tenantSlug}
      </p>
    </div>
  );
}

function NavList({
  items,
  pathname,
  urgentFeedbackCount = 0,
}: {
  items: readonly AdminNavItem[];
  pathname: string;
  urgentFeedbackCount?: number;
}) {
  const router = useRouter();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isAdminNavActive(pathname, item);
        const Icon = item.icon;
        const showUrgentBadge =
          item.href === "/admin/dashboard/feedback" && urgentFeedbackCount > 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={item.description}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (active) return;
                if (!isAdminLeaveBlocked()) return;
                event.preventDefault();
                requestAdminLeave(() => {
                  router.push(item.href);
                });
              }}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                active
                  ? "bg-live-muted text-live-ink"
                  : "text-foreground/80 hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon
                className={`size-4 shrink-0 ${active ? "opacity-100" : "opacity-70"}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {showUrgentBadge ? (
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-md bg-destructive px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums text-destructive-foreground"
                  aria-label={`${urgentFeedbackCount} opiniones urgentes`}
                >
                  {urgentFeedbackCount > 9 ? "9+" : urgentFeedbackCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
