"use client";

/**
 * Login de personal en 2 pasos: selección de empleado → PIN táctil.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChefHat, Delete, Shield, UserRound } from "lucide-react";
import {
  getLoginErrorMessage,
  loginWithPin,
  setToken,
} from "@/services/authService";
import { homePathForRole } from "@/lib/jwt-payload";
import type { PublicStaffMember, StaffRole } from "@/types/api";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1017]";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

function roleMeta(role: StaffRole): {
  label: string;
  badgeClass: string;
  Icon: typeof ChefHat;
} {
  switch (role) {
    case "COCINA":
      return {
        label: "Cocina",
        badgeClass: "bg-orange-400/20 text-orange-200 ring-1 ring-orange-300/30",
        Icon: ChefHat,
      };
    case "MESERO":
      return {
        label: "Mesero",
        badgeClass: "bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/30",
        Icon: UserRound,
      };
    case "ADMIN":
      return {
        label: "Admin",
        badgeClass: "bg-violet-400/20 text-violet-200 ring-1 ring-violet-300/30",
        Icon: Shield,
      };
    default:
      return {
        label: String(role),
        badgeClass: "bg-white/15 text-white/80 ring-1 ring-white/20",
        Icon: UserRound,
      };
  }
}

interface StaffPinLoginProps {
  tenantSlug: string;
  restaurantName: string;
  initialStaff: PublicStaffMember[];
}

export function StaffPinLogin({
  tenantSlug,
  restaurantName,
  initialStaff,
}: StaffPinLoginProps) {
  const [selected, setSelected] = useState<PublicStaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const submittingRef = useRef(false);
  const selectedRef = useRef<PublicStaffMember | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    if (!shake) return;
    const timer = window.setTimeout(() => setShake(false), 450);
    return () => window.clearTimeout(timer);
  }, [shake]);

  const goBackToSelection = useCallback(() => {
    submittingRef.current = false;
    setSelected(null);
    setPin("");
    setError(null);
    setBusy(false);
    setShake(false);
  }, []);

  const submitPin = useCallback(
    async (value: string, member: PublicStaffMember) => {
      if (submittingRef.current || value.length !== 4) return;
      submittingRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const result = await loginWithPin(member.id, value, tenantSlug);
        await setToken(result.token);
        const dest = homePathForRole(result.role);
        // Navegación completa: garantiza que el proxy lea la cookie HttpOnly
        // (router.replace a veces corre antes de que la cookie esté disponible).
        window.location.assign(dest);
      } catch (err) {
        submittingRef.current = false;
        setBusy(false);
        setError(getLoginErrorMessage(err));
        setPin("");
        setShake(true);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(80);
        }
      }
    },
    [tenantSlug],
  );

  function pressKey(key: (typeof KEYS)[number]) {
    const member = selectedRef.current;
    if (!member || busy || submittingRef.current || key === "") return;
    setError(null);

    if (key === "del") {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    setPin((prev) => {
      if (prev.length >= 4) return prev;
      return prev + key;
    });
  }

  // Dispara el login cuando el PIN llega a 4 dígitos (fuera del updater de estado).
  useEffect(() => {
    const member = selectedRef.current;
    if (!member || pin.length !== 4 || submittingRef.current) return;
    void submitPin(pin, member);
  }, [pin, submitPin]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_#1a2332_0%,_#0c1017_55%,_#07090d_100%)] px-4 py-10 font-jakarta-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(circle at 80% 70%, rgba(251,146,60,0.1), transparent 35%)",
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300/90">
            PlatoListo · Equipo
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {restaurantName}
          </h1>
          <p className="mt-2 text-sm text-white/65">
            {selected
              ? `Ingresa el PIN de ${selected.name}`
              : "Selecciona tu usuario para continuar"}
          </p>
        </header>

        {!selected ? (
          <StaffSelectionGrid
            staff={initialStaff}
            onSelect={(member) => {
              submittingRef.current = false;
              setSelected(member);
              setPin("");
              setError(null);
              setBusy(false);
            }}
          />
        ) : (
          <PinPad
            member={selected}
            pin={pin}
            busy={busy}
            error={error}
            shake={shake}
            onBack={goBackToSelection}
            onPressKey={pressKey}
          />
        )}
      </div>
    </div>
  );
}

function StaffSelectionGrid({
  staff,
  onSelect,
}: {
  staff: PublicStaffMember[];
  onSelect: (member: PublicStaffMember) => void;
}) {
  if (staff.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-10 text-center backdrop-blur">
        <p className="text-base font-semibold">Sin personal activo</p>
        <p className="mt-2 text-sm text-white/60">
          Pide al administrador que agregue miembros en Equipo.
        </p>
      </div>
    );
  }

  return (
    <ul
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      aria-label="Personal activo"
    >
      {staff.map((member) => {
        const meta = roleMeta(member.role);
        const Icon = meta.Icon;
        return (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => onSelect(member)}
              className={`flex min-h-[5.5rem] w-full flex-col items-start justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-left backdrop-blur transition hover:border-white/25 hover:bg-white/15 active:scale-[0.98] ${focusRing}`}
            >
              <span className="flex w-full items-center gap-3">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5 opacity-90" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold tracking-tight">
                    {member.name}
                  </span>
                  <span
                    className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PinPad({
  member,
  pin,
  busy,
  error,
  shake,
  onBack,
  onPressKey,
}: {
  member: PublicStaffMember;
  pin: string;
  busy: boolean;
  error: string | null;
  shake: boolean;
  onBack: () => void;
  onPressKey: (key: (typeof KEYS)[number]) => void;
}) {
  const meta = roleMeta(member.role);

  return (
    <div className="mx-auto w-full max-w-sm">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className={`mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-white/75 transition hover:text-white disabled:opacity-50 ${focusRing}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver / Cambiar de usuario
      </button>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{member.name}</p>
          <span
            className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
        </div>
      </div>

      <div
        className={`mb-6 flex justify-center gap-3 ${
          shake ? "motion-safe:animate-[staff-pin-shake_0.4s_ease-in-out]" : ""
        }`}
        aria-label={`PIN: ${pin.length} de 4 dígitos`}
        role="status"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full transition-colors ${
              i < pin.length
                ? error
                  ? "bg-red-300 shadow-[0_0_12px_rgba(252,165,165,0.55)]"
                  : "bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.55)]"
                : "bg-white/20"
            }`}
          />
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-center text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      <div
        className="grid grid-cols-3 gap-3"
        role="group"
        aria-label="Teclado numérico"
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
                aria-label="Borrar"
                className={`flex min-h-16 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold backdrop-blur transition active:scale-[0.97] hover:bg-white/15 disabled:opacity-40 ${focusRing}`}
              >
                <Delete className="size-6" aria-hidden />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => onPressKey(key)}
              className={`flex min-h-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold tabular-nums backdrop-blur transition active:scale-[0.97] hover:bg-white/15 disabled:opacity-50 ${focusRing}`}
            >
              {key}
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-white/45">
        {busy ? "Verificando PIN…" : "Acceso rápido para el turno"}
      </p>
    </div>
  );
}
