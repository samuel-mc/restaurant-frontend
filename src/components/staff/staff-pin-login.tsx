"use client";

/**
 * Login de personal en 2 pasos: selección de empleado → PIN táctil.
 * Misma familia de color Operate que el login admin (live / warn / surface).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import Link from "next/link";
import { ArrowLeft, Delete, Search, UsersRound, X } from "lucide-react";
import { AdminLoginBrand } from "@/components/admin/admin-login-brand";
import { whatsappChatUrl } from "@/lib/contact-links";
import {
  getStaffPinErrorMessage,
  isStaffPinAccessFailure,
  loginWithPin,
  setToken,
} from "@/services/authService";
import { homePathForRole } from "@/lib/jwt-payload";
import type { PublicStaffMember, StaffRole } from "@/types/api";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-live focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const linkClass = `inline-flex min-h-11 touch-manipulation items-center justify-center rounded-sm px-1 font-semibold text-live-ink underline-offset-2 hover:underline ${focusRing}`;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

const ROLE_ORDER: StaffRole[] = ["COCINA", "MESERO", "ADMIN"];

const lastStaffStorageKey = (tenantSlug: string) =>
  `platolisto.staff.lastId.${tenantSlug}`;

/**
 * Badges de rol = categoría, no alarma.
 * `warn` queda para busy / offline / atención ahora (DESIGN Attention rule).
 */
function roleMeta(role: StaffRole): { label: string; badgeClass: string } {
  switch (role) {
    case "COCINA":
      return {
        label: "Cocina",
        badgeClass: "border border-border bg-secondary text-foreground",
      };
    case "MESERO":
      return {
        label: "Mesero",
        badgeClass: "bg-channel-muted text-channel-ink",
      };
    case "ADMIN":
      return { label: "Administrador", badgeClass: "bg-primary/15 text-primary" };
    default:
      return {
        label: String(role),
        badgeClass: "border border-border bg-secondary text-muted-foreground",
      };
  }
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function isKnownStaffRole(role: string): role is StaffRole {
  return ROLE_ORDER.includes(role as StaffRole);
}

/** Descarta filas inválidas o duplicadas que romperían la selección. */
function sanitizeStaff(staff: PublicStaffMember[]): PublicStaffMember[] {
  const seen = new Set<string>();
  const out: PublicStaffMember[] = [];
  for (const member of staff) {
    const id = member?.id?.trim();
    const name = member?.name?.trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      ...member,
      id,
      name,
      role: isKnownStaffRole(member.role) ? member.role : "MESERO",
    });
  }
  return out;
}

function readLastStaffId(tenantSlug: string): string | null {
  try {
    return sessionStorage.getItem(lastStaffStorageKey(tenantSlug));
  } catch {
    return null;
  }
}

function writeLastStaffId(tenantSlug: string, staffId: string) {
  try {
    sessionStorage.setItem(lastStaffStorageKey(tenantSlug), staffId);
  } catch {
    // sessionStorage puede fallar en modo privado / cuota.
  }
}

/** sessionStorage no notifica same-tab; storage cubre otras pestañas. */
function subscribeLastStaffId(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

interface StaffPinLoginProps {
  tenantSlug: string;
  restaurantName: string;
  logoUrl?: string | null;
  whatsapp?: string | null;
  initialStaff: PublicStaffMember[];
  /** Fallo al cargar el directorio (distinto de lista vacía). */
  directoryLoadFailed?: boolean;
}

export function StaffPinLogin({
  tenantSlug,
  restaurantName,
  logoUrl = null,
  whatsapp = null,
  initialStaff,
  directoryLoadFailed = false,
}: StaffPinLoginProps) {
  const staff = useMemo(() => sanitizeStaff(initialStaff), [initialStaff]);
  const [selected, setSelected] = useState<PublicStaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [offline, setOffline] = useState(false);
  const submittingRef = useRef(false);
  const busyRef = useRef(false);
  const attemptRef = useRef(0);
  /** Fallos de acceso (401) seguidos para el mismo miembro — recovery tras el 2º. */
  const accessFailStreakRef = useRef(0);
  const mountedRef = useRef(true);
  const selectedRef = useRef<PublicStaffMember | null>(null);
  const errorAlertRef = useRef<HTMLParagraphElement>(null);

  const lastStaffId = useSyncExternalStore(
    subscribeLastStaffId,
    () => readLastStaffId(tenantSlug),
    () => null,
  );

  // Mirror state for event handlers / async checks — never write refs during render.
  useEffect(() => {
    selectedRef.current = selected;
    busyRef.current = busy;
  }, [selected, busy]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const invalidateInFlight = useCallback(() => {
    attemptRef.current += 1;
    submittingRef.current = false;
  }, []);

  const goBackToSelection = useCallback(() => {
    invalidateInFlight();
    accessFailStreakRef.current = 0;
    setSelected(null);
    setPin("");
    setError(null);
    setShowRecovery(false);
    setBusy(false);
  }, [invalidateInFlight]);

  const failPinAttempt = useCallback((message: string, accessFailure: boolean) => {
    submittingRef.current = false;
    setBusy(false);
    setError(message);
    if (accessFailure) {
      accessFailStreakRef.current += 1;
      // Primer typo: solo el error. Recovery a partir del 2º fallo de acceso.
      setShowRecovery(accessFailStreakRef.current >= 2);
    } else {
      accessFailStreakRef.current = 0;
      setShowRecovery(false);
    }
    setPin("");
    // Haptic breve — respeta prefers-reduced-motion.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (
      !reduceMotion &&
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      navigator.vibrate?.(35);
    }
    queueMicrotask(() => errorAlertRef.current?.focus());
  }, []);

  const submitPin = useCallback(
    async (value: string, member: PublicStaffMember) => {
      if (submittingRef.current || value.length !== 6) return;
      submittingRef.current = true;
      const attempt = ++attemptRef.current;
      setBusy(true);
      setError(null);
      setShowRecovery(false);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (attempt !== attemptRef.current) return;
        failPinAttempt(
          "Sin conexión. Revisa la red e inténtalo de nuevo.",
          false,
        );
        return;
      }

      try {
        const result = await loginWithPin(member.id, value, tenantSlug);
        if (
          !mountedRef.current ||
          attempt !== attemptRef.current ||
          selectedRef.current?.id !== member.id
        ) {
          return;
        }
        accessFailStreakRef.current = 0;
        writeLastStaffId(tenantSlug, member.id);
        await setToken(result.token);
        if (
          !mountedRef.current ||
          attempt !== attemptRef.current ||
          selectedRef.current?.id !== member.id
        ) {
          return;
        }
        const dest = homePathForRole(result.role);
        // Navegación completa: garantiza que el proxy lea la cookie HttpOnly
        // (router.replace a veces corre antes de que la cookie esté disponible).
        window.location.assign(dest);
      } catch (err) {
        if (
          !mountedRef.current ||
          attempt !== attemptRef.current ||
          selectedRef.current?.id !== member.id
        ) {
          return;
        }
        failPinAttempt(
          getStaffPinErrorMessage(err),
          isStaffPinAccessFailure(err),
        );
      }
    },
    [failPinAttempt, tenantSlug],
  );

  const pressKey = useCallback((key: (typeof KEYS)[number]) => {
    const member = selectedRef.current;
    if (
      !member ||
      busyRef.current ||
      submittingRef.current ||
      key === ""
    ) {
      return;
    }
    setError(null);
    setShowRecovery(false);

    if (key === "del") {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    setPin((prev) => {
      if (prev.length >= 6) return prev;
      return prev + key;
    });
  }, []);

  // Dispara el login cuando el PIN llega a 6 dígitos (fuera del updater de estado).
  useEffect(() => {
    const member = selectedRef.current;
    if (!member || pin.length !== 6 || submittingRef.current) return;
    void submitPin(pin, member);
  }, [pin, submitPin]);

  // Teclado físico: dígitos, borrar, Escape (cancela envío o vuelve al roster).
  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (busyRef.current || submittingRef.current) {
          invalidateInFlight();
          setBusy(false);
          setPin("");
          setError(null);
          setShowRecovery(false);
          return;
        }
        goBackToSelection();
        return;
      }

      if (busyRef.current || submittingRef.current) return;

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pressKey(event.key as (typeof KEYS)[number]);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        pressKey("del");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, goBackToSelection, invalidateInFlight, pressKey]);

  const selectMember = useCallback(
    (member: PublicStaffMember) => {
      invalidateInFlight();
      accessFailStreakRef.current = 0;
      setSelected(member);
      setPin("");
      setError(null);
      setShowRecovery(false);
      setBusy(false);
    },
    [invalidateInFlight],
  );

  const stepDescription = directoryLoadFailed
    ? "No pudimos cargar el equipo"
    : staff.length === 0
      ? "Falta registrar el equipo"
      : "Elige tu nombre";
  const descriptionMuted = directoryLoadFailed || staff.length === 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] font-jakarta-sans text-foreground">
      {!selected ? (
        <>
          <div className="shrink-0 pt-2 sm:pt-4">
            <AdminLoginBrand
              restaurantName={restaurantName}
              logoUrl={logoUrl}
              description={stepDescription}
              descriptionMuted={descriptionMuted}
              compact
            />
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col gap-5 ${
              directoryLoadFailed || staff.length === 0
                ? "justify-center pt-6"
                : "justify-start pt-6"
            }`}
          >
            {directoryLoadFailed ? (
              <StaffDirectoryError />
            ) : (
              <>
                <StaffSelectionGrid
                  staff={staff}
                  lastStaffId={lastStaffId}
                  restaurantName={restaurantName}
                  whatsapp={whatsapp}
                  onSelect={selectMember}
                />
                {staff.length > 0 ? <StaffAccessHelp /> : null}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mx-auto flex w-full max-w-sm min-h-0 flex-1 flex-col justify-end gap-3 pb-2 pt-3">
          <AdminLoginBrand
            restaurantName={restaurantName}
            logoUrl={logoUrl}
            chip
          />
          <PinPad
            member={selected}
            pin={pin}
            busy={busy}
            error={error}
            showRecovery={showRecovery}
            offline={offline}
            errorAlertRef={errorAlertRef}
            onBack={goBackToSelection}
            onPressKey={pressKey}
          />
        </div>
      )}
    </main>
  );
}

function StaffAccessHelp() {
  return (
    <div className="shrink-0 space-y-2 pb-2 text-center text-sm leading-snug">
      <p className="text-muted-foreground">
        ¿No aparece tu nombre? Pide al encargado que te agregue.
      </p>
      <p>
        <Link href="/admin/login" className={linkClass}>
          Acceso para el administrador
        </Link>
      </p>
    </div>
  );
}

function StaffDirectoryError() {
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-sm flex-col items-center px-1 py-4 text-center"
    >
      <p className="max-w-sm text-sm leading-snug text-muted-foreground">
        Revisa la red e inténtalo de nuevo. Si sigue fallando, avisa al
        encargado.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl bg-live px-4 text-sm font-bold text-live-foreground ${focusRing}`}
        >
          Reintentar
        </button>
        <Link
          href="/admin/login"
          className={`inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary ${focusRing}`}
        >
          Entrar como encargado
        </Link>
      </div>
    </div>
  );
}

function StaffMemberButton({
  member,
  onSelect,
  emphasized = false,
}: {
  member: PublicStaffMember;
  onSelect: (member: PublicStaffMember) => void;
  emphasized?: boolean;
}) {
  const meta = roleMeta(member.role);
  const initials = initialsFor(member.name);

  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      aria-label={`${member.name}, ${meta.label}`}
      className={`flex min-h-14 w-full touch-manipulation select-none items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-secondary active:bg-secondary ${
        emphasized
          ? "border-live/35 bg-live-muted/30"
          : "border-border bg-card"
      } ${focusRing}`}
    >
      <span
        aria-hidden
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
          emphasized
            ? "bg-live-muted text-live-ink"
            : "bg-secondary text-foreground"
        }`}
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight">
          {member.name}
        </span>
        <span
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
      </span>
    </button>
  );
}

function StaffSelectionGrid({
  staff,
  lastStaffId,
  restaurantName,
  whatsapp,
  onSelect,
}: {
  staff: PublicStaffMember[];
  lastStaffId: string | null;
  restaurantName: string;
  whatsapp: string | null;
  onSelect: (member: PublicStaffMember) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const showSearch = staff.length >= 5;

  const filteredStaff = useMemo(() => {
    if (!normalizedQuery) return staff;
    return staff.filter((member) =>
      member.name.toLocaleLowerCase("es").includes(normalizedQuery),
    );
  }, [staff, normalizedQuery]);

  const recent = useMemo(() => {
    if (!lastStaffId || normalizedQuery) return null;
    return filteredStaff.find((member) => member.id === lastStaffId) ?? null;
  }, [filteredStaff, lastStaffId, normalizedQuery]);

  const roleGroups = useMemo(() => {
    const excludeId = recent?.id ?? null;
    const byRole = new Map<StaffRole, PublicStaffMember[]>();
    for (const role of ROLE_ORDER) byRole.set(role, []);
    for (const member of filteredStaff) {
      if (excludeId && member.id === excludeId) continue;
      const list = byRole.get(member.role) ?? [];
      list.push(member);
      byRole.set(member.role, list);
    }
    for (const list of byRole.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return ROLE_ORDER.map((role) => ({
      role,
      label: roleMeta(role).label,
      members: byRole.get(role) ?? [],
    })).filter((group) => group.members.length > 0);
  }, [filteredStaff, recent]);

  // Headings de rol solo cuando el roster es lo bastante largo para particionar.
  const remainingCount = roleGroups.reduce(
    (sum, group) => sum + group.members.length,
    0,
  );
  const showRoleHeadings =
    roleGroups.length > 1 &&
    (remainingCount >= 5 ||
      roleGroups.some((group) => group.members.length >= 3));

  const flatMembers = useMemo(
    () => roleGroups.flatMap((group) => group.members),
    [roleGroups],
  );

  const noMatches = filteredStaff.length === 0 && staff.length > 0;

  if (staff.length === 0) {
    return (
      <StaffEmptyState restaurantName={restaurantName} whatsapp={whatsapp} />
    );
  }

  return (
    <div
      role="region"
      className={`flex min-h-0 flex-col gap-4 ${
        showSearch ? "flex-1" : "shrink-0"
      }`}
      aria-label="Equipo del turno"
    >
      {showSearch ? (
        <div className="shrink-0">
          <label htmlFor={searchId} className="sr-only">
            Buscar por nombre
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id={searchId}
              type="text"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 64))}
              placeholder="Buscar por nombre"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={64}
              enterKeyHint="search"
              className={`min-h-11 w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-14 text-base outline-none transition focus-visible:border-live focus-visible:ring-2 focus-visible:ring-live/20 sm:text-sm`}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className={`absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground ${focusRing}`}
                aria-label="Borrar búsqueda"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={`flex min-h-0 flex-col overscroll-contain ${
          showSearch ? "flex-1 overflow-y-auto" : "shrink-0"
        } ${showRoleHeadings ? "gap-5" : "gap-3"}`}
      >
        {noMatches ? (
          <div
            role="status"
            className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
          >
            <p className="[overflow-wrap:anywhere]">
              No hay nadie con “
              <span className="font-medium text-foreground">
                {query.trim().slice(0, 40)}
                {query.trim().length > 40 ? "…" : ""}
              </span>
              ”.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`mt-3 inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl px-3 text-sm font-semibold text-live-ink underline-offset-2 hover:underline ${focusRing}`}
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : null}

        {recent ? (
          <section className="shrink-0" aria-labelledby="staff-recent-heading">
            <h2
              id="staff-recent-heading"
              className="mb-2 text-xs font-semibold tracking-wide text-live-ink"
            >
              Tú otra vez
            </h2>
            <StaffMemberButton
              member={recent}
              onSelect={onSelect}
              emphasized
            />
          </section>
        ) : null}

        {showRoleHeadings
          ? roleGroups.map((group) => (
              <section
                key={group.role}
                className="min-w-0"
                aria-labelledby={`staff-role-${group.role}`}
              >
                <h2
                  id={`staff-role-${group.role}`}
                  className="sticky top-0 z-10 mb-2 bg-background py-1 text-xs font-semibold tracking-wide text-muted-foreground"
                >
                  {group.label}
                </h2>
                <ul className="grid grid-cols-1 gap-2">
                  {group.members.map((member) => (
                    <li key={member.id} className="min-w-0">
                      <StaffMemberButton
                        member={member}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          : flatMembers.length > 0
            ? (
                <ul
                  className="grid grid-cols-1 gap-2"
                  aria-label={recent ? "Resto del equipo" : undefined}
                >
                  {flatMembers.map((member) => (
                    <li key={member.id} className="min-w-0">
                      <StaffMemberButton
                        member={member}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
              )
            : null}
      </div>
    </div>
  );
}

function StaffEmptyState({
  restaurantName,
  whatsapp,
}: {
  restaurantName: string;
  whatsapp: string | null;
}) {
  const helpWhatsApp = whatsappChatUrl(whatsapp, {
    text: `Hola, soy del equipo de ${restaurantName}. ¿Me puedes agregar para entrar con PIN?`,
  });

  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-sm flex-col items-center px-1 py-4 text-center"
    >
      <span
        aria-hidden
        className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-live-muted text-live-ink"
      >
        <UsersRound className="size-6" />
      </span>
      {/* Un solo titular: la marca ya dice “Falta registrar el equipo”. */}
      <p className="max-w-sm text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
        Registra los nombres una vez. Después cada quien entra con su PIN.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/admin/login"
          className={`inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl bg-live px-4 text-sm font-bold text-live-foreground ${focusRing}`}
        >
          Entrar como encargado
        </Link>
        {helpWhatsApp ? (
          <a
            href={helpWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary ${focusRing}`}
          >
            Escribir al encargado
          </a>
        ) : null}
        <Link href="/menu" className={linkClass}>
          Ver el menú
        </Link>
      </div>
    </div>
  );
}

function PinPad({
  member,
  pin,
  busy,
  error,
  showRecovery,
  offline,
  errorAlertRef,
  onBack,
  onPressKey,
}: {
  member: PublicStaffMember;
  pin: string;
  busy: boolean;
  error: string | null;
  showRecovery: boolean;
  offline: boolean;
  errorAlertRef: RefObject<HTMLParagraphElement | null>;
  onBack: () => void;
  onPressKey: (key: (typeof KEYS)[number]) => void;
}) {
  const meta = roleMeta(member.role);
  const recoveryId = useId();
  const errorId = useId();
  const offlineId = useId();
  const showFailedDots = Boolean(error) && pin.length === 0;
  const initials = initialsFor(member.name);
  const padDescribedBy =
    [
      offline ? offlineId : null,
      busy ? "staff-pin-busy" : null,
      error ? errorId : null,
      error && showRecovery ? recoveryId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const pinStatusLabel = busy
    ? "Comprobando PIN…"
    : showFailedDots
      ? "Ese PIN no coincide. Inténtalo de nuevo."
      : `PIN: ${pin.length} de 6`;
  // Hint bajo el pad solo cuando no hay banner/alert que ya diga lo mismo.
  const statusHint =
    busy || error || offline ? null : "Al completar 6 dígitos entras";

  return (
    <div className="w-full">
      <div className="mb-2">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex min-h-11 min-w-0 touch-manipulation items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${focusRing}`}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Elegir otro nombre</span>
        </button>
      </div>

      {/* Cluster de tarea: identidad + dots + estado pegados al pad. */}
      <div className="mb-3 flex flex-col items-center gap-2.5 text-center">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold"
          >
            {initials}
          </span>
          <div className="min-w-0 text-left">
            <p className="truncate text-base font-semibold tracking-tight">
              {member.name}
            </p>
            <span
              className={`mt-1 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
          </div>
        </div>

        <div
          className="flex justify-center gap-3.5"
          aria-label={pinStatusLabel}
          aria-busy={busy || undefined}
          role="status"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`size-4 rounded-full transition-colors ${
                busy
                  ? "bg-warn motion-safe:animate-pulse"
                  : i < pin.length
                    ? "bg-live"
                    : showFailedDots
                      ? "bg-transparent ring-1 ring-destructive/45"
                      : "bg-secondary ring-1 ring-border"
              }`}
            />
          ))}
        </div>

        {busy ? (
          <p
            id="staff-pin-busy"
            className="text-sm font-medium text-warn-ink"
            aria-live="polite"
          >
            Comprobando PIN…
          </p>
        ) : null}
      </div>

      {offline && !busy ? (
        <p
          id={offlineId}
          role="status"
          className="mb-3 text-center text-sm font-medium text-warn-ink [overflow-wrap:anywhere]"
        >
          Sin conexión. Puedes escribir el PIN; enviarlo requiere red.
        </p>
      ) : null}

      {error && !busy ? (
        <div className="mb-3 flex flex-col gap-1.5 text-center">
          <p
            ref={errorAlertRef}
            id={errorId}
            role="alert"
            tabIndex={-1}
            className="text-sm leading-snug text-foreground outline-none [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-live/30"
          >
            {error}
          </p>
          {showRecovery ? (
            <p
              id={recoveryId}
              className="text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]"
            >
              ¿Olvidaste el PIN? Pídeselo al encargado.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className="grid grid-cols-3 gap-2.5"
        role="group"
        aria-label="Teclado numérico"
        aria-describedby={padDescribedBy}
        aria-disabled={busy || undefined}
      >
        {KEYS.map((key, index) => {
          if (key === "") {
            return <span key={`empty-${index}`} aria-hidden />;
          }
          if (key === "del") {
            return (
              <button
                key="del"
                type="button"
                disabled={busy || pin.length === 0}
                onClick={() => onPressKey("del")}
                aria-label="Borrar último dígito"
                className={`flex min-h-16 touch-manipulation select-none items-center justify-center rounded-xl bg-secondary text-foreground transition-[colors,transform] hover:bg-muted active:bg-muted motion-safe:active:scale-[0.97] disabled:cursor-wait disabled:opacity-40 disabled:active:scale-100 ${focusRing}`}
              >
                <Delete className="size-5" aria-hidden />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => onPressKey(key)}
              aria-label={`Dígito ${key}`}
              className={`flex min-h-16 touch-manipulation select-none items-center justify-center rounded-xl bg-secondary text-xl font-medium tabular-nums transition-[colors,transform] hover:bg-muted active:bg-muted motion-safe:active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 disabled:active:scale-100 ${focusRing}`}
            >
              {key}
            </button>
          );
        })}
      </div>

      <p
        className="mt-3 min-h-4 text-center text-xs text-muted-foreground"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusHint}
      </p>
    </div>
  );
}
