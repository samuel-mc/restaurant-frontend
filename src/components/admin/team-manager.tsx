"use client";

/**
 * Gestión de equipo: listado, alta, activar/desactivar y cambio de PIN.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Plus, KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { setAdminLeaveBlocker } from "@/lib/admin-leave-guard";
import {
  STAFF_PIN_LENGTH,
  isStaffPinFormat,
  staffPinCreateError,
} from "@/lib/staff-pin";
import {
  createTeamMember,
  deactivateTeamMember,
  updateTeamMember,
} from "@/services/adminTeamService";
import type { StaffMemberResponse, StaffRole } from "@/types/api";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const btnPrimary = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 ${focusRing}`;
const btnSecondary = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary active:bg-secondary disabled:opacity-50 ${focusRing}`;
/** Acción de fila secundaria: menos peso que Cambiar PIN para evitar mistaps. */
const btnQuiet = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary disabled:opacity-50 ${focusRing}`;
const btnQuietDanger = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 disabled:opacity-50 ${focusRing}`;

const pinInputClass = `w-full min-h-11 rounded-xl border border-border bg-secondary px-3 text-base font-medium tracking-[0.3em] tabular-nums md:text-sm ${focusRing}`;
const fieldInputClass = `w-full min-h-11 rounded-xl border border-border bg-secondary px-3 text-base font-medium md:text-sm ${focusRing}`;
const btnLink = `inline-flex min-h-9 items-center self-start rounded-lg px-1 text-xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline ${focusRing}`;
const bannerDismiss = `inline-flex min-h-9 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold transition-colors ${focusRing}`;
/** Bottom sheet on phone; centered card from sm. Safe-area + scroll for landscape. */
const modalPanel =
  "w-full max-w-md max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:rounded-2xl sm:pb-5";
const modalActions =
  "mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto";
/** Under mobile shell header; flush under content top once sidebar is visible. */
const stickySurface =
  "sticky z-20 top-[calc(4rem+env(safe-area-inset-top,0px))] scroll-mt-[calc(4rem+env(safe-area-inset-top,0px))] md:top-3 md:scroll-mt-3";
const chipClass =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-none";

const ROLE_OPTIONS: {
  value: StaffRole;
  label: string;
  access: string;
}[] = [
  {
    value: "MESERO",
    label: "Mesero",
    access: "Accede a mesas y cuentas en el salón.",
  },
  {
    value: "COCINA",
    label: "Cocina",
    access: "Accede al monitor de cocina (comandas en vivo).",
  },
  {
    value: "ADMIN",
    label: "Administrador",
    access: "Accede al panel completo: menú, equipo y ajustes.",
  },
];

const SUCCESS_BANNER_MS = 4200;
/** Ventana para recuperar el PIN tras “Ya se lo dije” (se pausa si la pestaña se oculta). */
const HANDOFF_UNDO_MS = 7000;
/** Cada “Más tiempo” suma esta cantidad al remanente. */
const HANDOFF_UNDO_EXTEND_MS = 7000;
const HANDOFF_LEAVE_TITLE = "PIN pendiente de entrega";
const HANDOFF_LEAVE_DESC =
  "Si sales ahora, no podrás volver a ver este PIN. Entrega el acceso o anótalo antes de continuar.";
const HANDOFF_COPY_FAIL =
  "No se pudo copiar el PIN. Anótalo o díselo en voz alta al miembro.";
const LOST_PIN_RECOVERY =
  "Si no se lo entregaste o lo olvidaron, usa Cambiar PIN.";
const DISCARD_REVIEW_TITLE = "¿Descartar este PIN?";
const DISCARD_REVIEW_DESC =
  "El PIN ya está listo para entregar. Si cierras ahora, tendrás que escribirlo de nuevo.";

type PinHandoff = {
  memberId: string;
  memberName: string;
  pin: string;
  kind: "create" | "update";
};

/** CTA on the post-handoff status banner. */
type StatusAction =
  | { kind: "add_another" }
  | { kind: "change_pin"; memberId: string; memberName: string };

type StatusFilter = "all" | "active";
type RoleFilter = "all" | StaffRole;

/**
 * Color strategy (Operate):
 * - `live` = estado Activo / éxito (conectado, listo).
 * - Roles = categoría: Administrador=primary, Mesero=channel (salón), Cocina=neutro.
 * - Nunca `live` ni `warn` en roles; `warn` = atención ahora.
 */
function roleBadge(role: StaffRole): { label: string; className: string } {
  switch (role) {
    case "ADMIN":
      return {
        label: "Administrador",
        className: "bg-primary/15 text-primary",
      };
    case "MESERO":
      return {
        label: "Mesero",
        className: "bg-channel-muted text-channel-ink",
      };
    case "COCINA":
      return {
        label: "Cocina",
        className: "border border-border bg-secondary text-foreground",
      };
  }
}

function statusBadge(active: boolean): { label: string; className: string } {
  if (active) {
    return {
      label: "Activo",
      className: "bg-live-muted text-live-ink",
    };
  }
  return {
    label: "Inactivo",
    className: "border border-transparent bg-muted text-muted-foreground",
  };
}

function normalizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, STAFF_PIN_LENGTH);
}

function namesMatch(a: string, b: string): boolean {
  return (
    a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es")
  );
}

/** Truncate long names in confirm copy without losing the list `title` affordance. */
function shortDisplayName(name: string, max = 42): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

interface TeamManagerProps {
  tenantSlug: string;
  initialMembers: StaffMemberResponse[];
}

export function TeamManager({ tenantSlug, initialMembers }: TeamManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [modalOpen, setModalOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<StaffMemberResponse | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    useState<StaffMemberResponse | null>(null);
  const [activateTarget, setActivateTarget] =
    useState<StaffMemberResponse | null>(null);
  const [handoffBlockOpen, setHandoffBlockOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handoffCopyError, setHandoffCopyError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [pinHandoff, setPinHandoff] = useState<PinHandoff | null>(null);
  const [handoffUndo, setHandoffUndo] = useState<PinHandoff | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pinConfirmError, setPinConfirmError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const statusTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const undoDeadlineRef = useRef<number | null>(null);
  const undoPausedRemainingRef = useRef<number | null>(null);
  const handoffDismissRef = useRef<HTMLButtonElement>(null);
  const handoffPinRef = useRef<HTMLParagraphElement>(null);
  const leaveProceedRef = useRef<(() => void) | null>(null);
  const [undoRemainingMs, setUndoRemainingMs] = useState(0);
  const [undoTotalMs, setUndoTotalMs] = useState(HANDOFF_UNDO_MS);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current != null) {
        window.clearTimeout(statusTimerRef.current);
      }
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      }),
    [members],
  );

  const filtered = useMemo(() => {
    if (members.length < 5) return sorted;
    const q = rosterQuery.trim().toLocaleLowerCase("es");
    return sorted.filter((member) => {
      if (statusFilter === "active" && !member.active) return false;
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (!q) return true;
      return member.name.toLocaleLowerCase("es").includes(q);
    });
  }, [members.length, sorted, rosterQuery, statusFilter, roleFilter]);

  function clearRosterFilters() {
    setRosterQuery("");
    setStatusFilter("all");
    setRoleFilter("all");
    setRoleMenuOpen(false);
  }

  /** Below the filter threshold, drop stale query/chips so the roster never reappears empty. */
  useEffect(() => {
    if (members.length >= 5) return;
    clearRosterFilters();
  }, [members.length]);

  useEffect(() => {
    if (!roleMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = roleMenuRef.current;
      if (root && !root.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRoleMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [roleMenuOpen]);

  const rosterFiltersActive =
    members.length >= 5 &&
    (rosterQuery.trim() !== "" ||
      statusFilter === "active" ||
      roleFilter !== "all");

  const selectedRoleLabel =
    ROLE_OPTIONS.find((opt) => opt.value === roleFilter)?.label ?? null;

  const activeCount = useMemo(
    () => members.filter((m) => m.active).length,
    [members],
  );

  const pendingHandoff = pinHandoff ?? handoffUndo;
  const showMobileAddSticky =
    members.length > 0 &&
    !pinHandoff &&
    !handoffUndo &&
    statusAction?.kind !== "add_another";

  useEffect(() => {
    if (!pendingHandoff) {
      setAdminLeaveBlocker(null);
      setLeaveConfirmOpen(false);
      leaveProceedRef.current = null;
      return;
    }
    setAdminLeaveBlocker({
      isActive: () => true,
      requestConfirm: (onConfirm) => {
        leaveProceedRef.current = onConfirm;
        setLeaveConfirmOpen(true);
      },
    });
    return () => {
      setAdminLeaveBlocker(null);
      leaveProceedRef.current = null;
    };
  }, [pendingHandoff]);

  useEffect(() => {
    if (!pendingHandoff) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingHandoff]);

  function clearStatusTimer() {
    if (statusTimerRef.current != null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }

  function clearUndoCountdown() {
    undoDeadlineRef.current = null;
    undoPausedRemainingRef.current = null;
    setUndoRemainingMs(0);
  }

  function readUndoRemainingMs(): number {
    if (undoDeadlineRef.current != null) {
      return Math.max(0, undoDeadlineRef.current - performance.now());
    }
    if (undoPausedRemainingRef.current != null) {
      return undoPausedRemainingRef.current;
    }
    return 0;
  }

  /** Suma tiempo al remanente; la barra se reinicia al nuevo total. */
  function extendHandoffUndo() {
    if (!handoffUndo) return;
    const next = readUndoRemainingMs() + HANDOFF_UNDO_EXTEND_MS;
    const hold =
      document.hidden || leaveConfirmOpen || handoffBlockOpen;
    if (hold) {
      undoPausedRemainingRef.current = next;
      undoDeadlineRef.current = null;
    } else {
      undoDeadlineRef.current = performance.now() + next;
      undoPausedRemainingRef.current = null;
    }
    setUndoRemainingMs(next);
    setUndoTotalMs(next);
  }

  /** Estado rutinario / post-entrega: banner breve; opcional CTA. */
  function showStatus(
    message: string,
    options?: { action?: StatusAction },
  ) {
    setStatusMessage(message);
    setStatusAction(options?.action ?? null);
    clearStatusTimer();
    const duration = options?.action
      ? SUCCESS_BANNER_MS * 2
      : SUCCESS_BANNER_MS;
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage((current) => (current === message ? null : current));
      setStatusAction(null);
      statusTimerRef.current = null;
    }, duration);
  }

  /** Entrega de acceso: PIN visible hasta dismiss + ventana de deshacer. */
  function showPinHandoff(
    memberId: string,
    memberName: string,
    pin: string,
    kind: PinHandoff["kind"],
  ) {
    setHandoffCopyError(null);
    setStatusMessage(null);
    setStatusAction(null);
    clearStatusTimer();
    clearUndoCountdown();
    setHandoffUndo(null);
    setPinCopied(false);
    setPinHandoff({ memberId, memberName, pin, kind });
  }

  /** Borra dígitos de pantalla antes de salir o cerrar la ventana de deshacer. */
  function clearPendingPinSurface() {
    clearUndoCountdown();
    setPinHandoff(null);
    setHandoffUndo(null);
    setHandoffCopyError(null);
    setPinCopied(false);
    setHandoffBlockOpen(false);
  }

  /** Cierra la tarjeta pero conserva el PIN unos segundos (Volver a la entrega). */
  function requestDismissHandoff() {
    if (!pinHandoff) return;
    const snapshot = pinHandoff;
    setPinHandoff(null);
    setPinCopied(false);
    setHandoffCopyError(null);
    setHandoffBlockOpen(false);
    clearUndoCountdown();
    undoDeadlineRef.current = performance.now() + HANDOFF_UNDO_MS;
    setUndoRemainingMs(HANDOFF_UNDO_MS);
    setUndoTotalMs(HANDOFF_UNDO_MS);
    setHandoffUndo(snapshot);
  }

  function undoHandoffDismiss() {
    if (!handoffUndo) return;
    const snapshot = handoffUndo;
    clearUndoCountdown();
    setHandoffUndo(null);
    setHandoffCopyError(null);
    setPinHandoff(snapshot);
    setPinCopied(false);
  }

  function commitHandoffDismiss() {
    const snapshot = handoffUndo;
    clearUndoCountdown();
    setHandoffUndo(null);
    setHandoffCopyError(null);
    setPinCopied(false);
    setHandoffBlockOpen(false);
    if (snapshot?.kind === "create") {
      showStatus(`${snapshot.memberName} ya puede entrar.`, {
        action: { kind: "add_another" },
      });
    } else if (snapshot?.kind === "update") {
      showStatus(`PIN de ${snapshot.memberName} actualizado.`);
    }
  }

  useEffect(() => {
    if (!handoffUndo) return;

    const memberId = handoffUndo.memberId;
    const memberName = handoffUndo.memberName;
    const dialogHoldsPin = leaveConfirmOpen || handoffBlockOpen;

    const expireUndo = () => {
      clearUndoCountdown();
      setHandoffUndo(null);
      setHandoffCopyError(null);
      setPinCopied(false);
      setHandoffBlockOpen(false);
      showStatus(`El PIN de ${memberName} ya no está en pantalla.`, {
        action: { kind: "change_pin", memberId, memberName },
      });
    };

    const pauseCountdown = () => {
      if (undoDeadlineRef.current == null) return;
      undoPausedRemainingRef.current = Math.max(
        0,
        undoDeadlineRef.current - performance.now(),
      );
      undoDeadlineRef.current = null;
      setUndoRemainingMs(undoPausedRemainingRef.current);
    };

    const resumeCountdown = () => {
      if (undoPausedRemainingRef.current == null) return;
      const remaining = undoPausedRemainingRef.current;
      undoPausedRemainingRef.current = null;
      if (remaining <= 0) {
        expireUndo();
        return;
      }
      undoDeadlineRef.current = performance.now() + remaining;
      setUndoRemainingMs(remaining);
    };

    const tick = () => {
      if (
        document.hidden ||
        dialogHoldsPin ||
        undoDeadlineRef.current == null
      ) {
        return;
      }
      const left = Math.max(0, undoDeadlineRef.current - performance.now());
      setUndoRemainingMs(left);
      if (left <= 0) {
        expireUndo();
      }
    };

    const onVisibility = () => {
      if (document.hidden) pauseCountdown();
      else if (!dialogHoldsPin) resumeCountdown();
    };

    if (undoDeadlineRef.current == null && undoPausedRemainingRef.current == null) {
      undoDeadlineRef.current = performance.now() + HANDOFF_UNDO_MS;
      setUndoRemainingMs(HANDOFF_UNDO_MS);
      setUndoTotalMs(HANDOFF_UNDO_MS);
    }

    if (document.hidden || dialogHoldsPin) pauseCountdown();
    else resumeCountdown();

    const intervalId = window.setInterval(tick, 100);
    document.addEventListener("visibilitychange", onVisibility);
    tick();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Countdown is driven by handoffUndo identity + refs; showStatus is local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffUndo, leaveConfirmOpen, handoffBlockOpen]);

  function dismissStatus() {
    clearStatusTimer();
    setStatusMessage(null);
    setStatusAction(null);
  }

  function runStatusAction() {
    if (!statusAction) return;
    if (statusAction.kind === "add_another") {
      openCreateModal();
      return;
    }
    const member = members.find((m) => m.id === statusAction.memberId);
    if (!member) {
      showStatus(
        `No encontramos a ${statusAction.memberName} en el equipo. ${LOST_PIN_RECOVERY}`,
      );
      return;
    }
    openPinModal(member);
  }

  const statusActionLabel =
    statusAction?.kind === "add_another"
      ? "Agregar otro"
      : statusAction?.kind === "change_pin"
        ? `Cambiar PIN · ${shortDisplayName(statusAction.memberName, 28)}`
        : null;

  /** Entrega pendiente (activa o en deshacer): no tapar/reemplazar el PIN. */
  function guardPendingHandoff(): boolean {
    if (!pendingHandoff) return true;
    setHandoffBlockOpen(true);
    return false;
  }

  function focusPendingHandoff() {
    setHandoffBlockOpen(false);
    if (handoffUndo && !pinHandoff) {
      undoHandoffDismiss();
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const surface = document.getElementById("team-pin-handoff-surface");
    surface?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
    const target = handoffPinRef.current ?? handoffDismissRef.current;
    target?.focus();
  }

  async function copyHandoffPin() {
    const source = pinHandoff ?? handoffUndo;
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source.pin);
      setHandoffCopyError(null);
      setPinCopied(true);
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setPinCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      setHandoffCopyError(HANDOFF_COPY_FAIL);
    }
  }

  async function handleCreate(input: {
    name: string;
    role: StaffRole;
    pin: string;
  }) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setCreateError(
        "Sin conexión. Revisa la red e intenta de nuevo.",
      );
      return;
    }
    setCreateError(null);
    setBusyId("create");
    try {
      const created = await createTeamMember(tenantSlug, input);
      setMembers((prev) => [...prev, created]);
      setModalOpen(false);
      showPinHandoff(created.id, created.name, input.pin, "create");
    } catch (err) {
      setCreateError(
        getAdminErrorMessage(
          err,
          "No se pudo agregar este miembro. Revisa la conexión e intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmActivate() {
    if (!activateTarget) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setActivateError(
        "Sin conexión. Revisa la red e intenta de nuevo.",
      );
      return;
    }
    setActivateError(null);
    setBusyId(activateTarget.id);
    try {
      const updated = await updateTeamMember(tenantSlug, activateTarget.id, {
        active: true,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === activateTarget.id ? updated : m)),
      );
      setActivateTarget(null);
      showStatus(
        `${updated.name} puede volver a entrar con su PIN.`,
      );
    } catch (err) {
      setActivateError(
        getAdminErrorMessage(
          err,
          "No se pudo activar a este miembro. Revisa la conexión e intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmChangePin(newPin: string) {
    if (!pinTarget) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPinConfirmError(
        "Sin conexión. Revisa la red e intenta de nuevo.",
      );
      return;
    }
    const memberId = pinTarget.id;
    const memberName = pinTarget.name;
    setPinConfirmError(null);
    setBusyId(memberId);
    try {
      const updated = await updateTeamMember(tenantSlug, memberId, {
        pin: newPin,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? updated : m)),
      );
      setPinTarget(null);
      showPinHandoff(memberId, memberName, newPin, "update");
    } catch (err) {
      setPinConfirmError(
        getAdminErrorMessage(
          err,
          "No se pudo cambiar el PIN. Revisa la conexión e intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setDeactivateError(
        "Sin conexión. Revisa la red e intenta de nuevo.",
      );
      return;
    }
    const memberName = deactivateTarget.name;
    setDeactivateError(null);
    setBusyId(deactivateTarget.id);
    try {
      await deactivateTeamMember(tenantSlug, deactivateTarget.id);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === deactivateTarget.id ? { ...m, active: false } : m,
        ),
      );
      setDeactivateTarget(null);
      showStatus(`${memberName} ya no puede entrar con su PIN.`);
    } catch (err) {
      setDeactivateError(
        getAdminErrorMessage(
          err,
          "No se pudo desactivar a este miembro. Revisa la conexión e intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  function openCreateModal() {
    if (busyId === "create") return;
    if (!guardPendingHandoff()) return;
    dismissStatus();
    setCreateError(null);
    setModalOpen(true);
  }

  function openPinModal(member: StaffMemberResponse) {
    if (busyId === member.id) return;
    if (!guardPendingHandoff()) return;
    dismissStatus();
    setPinConfirmError(null);
    setPinTarget(member);
  }

  function closePinModal() {
    if (pinTarget && busyId === pinTarget.id) return;
    setPinTarget(null);
    setPinConfirmError(null);
  }

  function openDeactivate(member: StaffMemberResponse) {
    if (busyId === member.id) return;
    if (!guardPendingHandoff()) return;
    dismissStatus();
    setDeactivateError(null);
    setDeactivateTarget(member);
  }

  function openActivate(member: StaffMemberResponse) {
    if (busyId === member.id) return;
    if (!guardPendingHandoff()) return;
    dismissStatus();
    setActivateError(null);
    setActivateTarget(member);
  }

  function rowBusyAction(
    memberId: string,
  ): "pin" | "activate" | "deactivate" | null {
    if (busyId !== memberId) return null;
    if (deactivateTarget?.id === memberId) return "deactivate";
    if (activateTarget?.id === memberId) return "activate";
    // PIN change, or in-flight after the dialog target was cleared.
    return "pin";
  }

  function memberHasPendingPin(memberId: string): boolean {
    return pendingHandoff?.memberId === memberId;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Mi Equipo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length === 0
              ? "Agrega al personal y entrega su PIN."
              : `${activeCount} activo${activeCount === 1 ? "" : "s"}${
                  members.length !== activeCount
                    ? ` · ${members.length - activeCount} inactivo${
                        members.length - activeCount === 1 ? "" : "s"
                      }`
                    : ""
                } · Entran en Acceso con PIN`}
          </p>
        </div>
        <button
          type="button"
          className={`${btnPrimary} hidden w-full shrink-0 sm:inline-flex sm:w-auto`}
          disabled={busyId === "create"}
          onClick={openCreateModal}
        >
          <Plus className="size-4" aria-hidden />
          Agregar miembro
        </button>
      </header>

      {pinHandoff ? (
        <PinHandoffCard
          handoff={pinHandoff}
          copied={pinCopied}
          copyError={handoffCopyError}
          dismissButtonRef={handoffDismissRef}
          pinRef={handoffPinRef}
          onDismiss={requestDismissHandoff}
          onCopy={() => void copyHandoffPin()}
        />
      ) : null}

      {handoffUndo && !pinHandoff ? (
        <PinHandoffUndoBar
          handoff={handoffUndo}
          copied={pinCopied}
          copyError={handoffCopyError}
          remainingMs={undoRemainingMs}
          totalMs={undoTotalMs}
          onUndo={undoHandoffDismiss}
          onCommit={commitHandoffDismiss}
          onExtend={extendHandoffUndo}
          onCopy={() => void copyHandoffPin()}
        />
      ) : null}

      {statusMessage && !pinHandoff && !handoffUndo ? (
        <div
          role="status"
          aria-live="polite"
          className={
            statusAction?.kind === "change_pin"
              ? "flex flex-col gap-2 rounded-xl border border-warn/40 bg-warn-muted px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              : "flex flex-col gap-2 rounded-xl bg-live-muted px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          }
        >
          <p
            className={`min-w-0 flex-1 text-sm font-semibold ${
              statusAction?.kind === "change_pin"
                ? "text-warn-ink"
                : "text-live-ink"
            }`}
          >
            {statusMessage}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {statusActionLabel && statusAction ? (
              <button
                type="button"
                className={btnPrimary}
                disabled={
                  statusAction.kind === "add_another"
                    ? busyId === "create"
                    : busyId === statusAction.memberId
                }
                onClick={runStatusAction}
              >
                {statusAction.kind === "add_another" ? (
                  <Plus className="size-4" aria-hidden />
                ) : (
                  <KeyRound className="size-4" aria-hidden />
                )}
                {statusActionLabel}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Cerrar mensaje"
              className={
                statusAction?.kind === "change_pin"
                  ? `${bannerDismiss} text-warn-ink/80 hover:bg-background/60 hover:text-warn-ink`
                  : `${bannerDismiss} text-live-ink/80 hover:bg-background/60 hover:text-live-ink`
              }
              onClick={dismissStatus}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {members.length >= 5 ? (
        <div className="flex flex-col gap-2">
          <label className="min-w-0 w-full">
            <span className="sr-only">Buscar por nombre</span>
            <input
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder="Buscar por nombre"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`${fieldInputClass} tracking-normal`}
            />
          </label>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filtros del equipo"
          >
            <button
              type="button"
              aria-pressed={statusFilter === "active"}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors ${focusRing} ${
                statusFilter === "active"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              onClick={() =>
                setStatusFilter((current) =>
                  current === "active" ? "all" : "active",
                )
              }
            >
              Solo activos
            </button>
            <div ref={roleMenuRef} className="relative shrink-0">
              <button
                type="button"
                aria-expanded={roleMenuOpen}
                aria-haspopup="listbox"
                aria-controls="team-role-filter-menu"
                aria-pressed={roleFilter !== "all"}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors ${focusRing} ${
                  roleFilter !== "all"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                onClick={() => setRoleMenuOpen((open) => !open)}
              >
                {selectedRoleLabel ?? "Rol"}
              </button>
              {roleMenuOpen ? (
                <div
                  id="team-role-filter-menu"
                  role="listbox"
                  aria-label="Filtrar por rol"
                  className="absolute left-0 top-full z-30 mt-1 min-w-[11rem] rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={roleFilter === "all"}
                    className={`flex w-full min-h-11 items-center rounded-lg px-3 text-left text-sm font-semibold transition-colors ${focusRing} ${
                      roleFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-secondary"
                    }`}
                    onClick={() => {
                      setRoleFilter("all");
                      setRoleMenuOpen(false);
                    }}
                  >
                    Todos
                  </button>
                  {ROLE_OPTIONS.map((opt) => {
                    const selected = roleFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`flex w-full min-h-11 items-center rounded-lg px-3 text-left text-sm font-semibold transition-colors ${focusRing} ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-secondary"
                        }`}
                        onClick={() => {
                          setRoleFilter(opt.value);
                          setRoleMenuOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          {rosterFiltersActive && filtered.length > 0 ? (
            <p
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              <span>
                {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className={btnLink}
                onClick={clearRosterFilters}
              >
                Ver todo
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyRoster onAdd={openCreateModal} disabled={busyId === "create"} />
      ) : (
        <>
          {/* Wide desktop table — cards stay through tablet / touch widths */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card xl:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Miembros del equipo</caption>
              <thead className="bg-secondary/50 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Nombre
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Rol
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <NoRosterMatch onClear={clearRosterFilters} />
                    </td>
                  </tr>
                ) : (
                  filtered.map((member) => {
                    const badge = roleBadge(member.role);
                    const status = statusBadge(member.active);
                    const pinPending = memberHasPendingPin(member.id);
                    return (
                      <tr
                        key={member.id}
                        className={`border-t border-border/80 transition-colors hover:bg-secondary/40 ${
                          member.active ? "" : "bg-muted/40"
                        } ${pinPending ? "bg-warn-muted/40" : ""}`}
                      >
                        <td className="max-w-[14rem] px-4 py-3.5 font-semibold">
                          <span className="block truncate" title={member.name}>
                            {member.name}
                          </span>
                          {pinPending ? (
                            <PendingPinChip
                              className="mt-1.5"
                              onReveal={focusPendingHandoff}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`${chipClass} ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`${chipClass} ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <MemberRowActions
                            member={member}
                            busyAction={rowBusyAction(member.id)}
                            onChangePin={() => openPinModal(member)}
                            onDeactivate={() => openDeactivate(member)}
                            onActivate={() => openActivate(member)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phone + tablet cards (two-up from sm for mid-service scanning) */}
          <ul
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden ${
              showMobileAddSticky ? "pb-20 sm:pb-0" : ""
            }`}
          >
            {filtered.length === 0 ? (
              <li className="rounded-2xl border border-border bg-card px-4 py-10 sm:col-span-2">
                <NoRosterMatch onClear={clearRosterFilters} />
              </li>
            ) : (
              filtered.map((member) => {
                const badge = roleBadge(member.role);
                const status = statusBadge(member.active);
                const pinPending = memberHasPendingPin(member.id);
                return (
                  <li
                    key={member.id}
                    className={`flex flex-col rounded-2xl border p-4 transition-colors ${
                      pinPending
                        ? "border-warn/40 bg-warn-muted/50"
                        : member.active
                          ? "border-border bg-card"
                          : "border-border bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-base font-semibold"
                        title={member.name}
                      >
                        {member.name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`${chipClass} ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className={`${chipClass} ${status.className}`}>
                          {status.label}
                        </span>
                        {pinPending ? (
                          <PendingPinChip onReveal={focusPendingHandoff} />
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-auto border-t border-border/70 pt-3">
                      <MemberRowActions
                        member={member}
                        busyAction={rowBusyAction(member.id)}
                        align="start"
                        onChangePin={() => openPinModal(member)}
                        onDeactivate={() => openDeactivate(member)}
                        onActivate={() => openActivate(member)}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}

      {/* Thumb-zone primary on phone; header CTA covers sm+. Hidden during PIN handoff / Agregar otro. */}
      {showMobileAddSticky ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-muted px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:hidden">
          <button
            type="button"
            className={`${btnPrimary} w-full`}
            disabled={busyId === "create"}
            onClick={openCreateModal}
          >
            <Plus className="size-4" aria-hidden />
            Agregar miembro
          </button>
        </div>
      ) : null}

      <MemberFormModal
        open={modalOpen}
        busy={busyId === "create"}
        existingNames={members.map((m) => m.name)}
        serverError={createError}
        onClearServerError={() => setCreateError(null)}
        onClose={() => {
          if (busyId === "create") return;
          setModalOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreate}
      />

      <PinFormModal
        open={!!pinTarget}
        memberName={pinTarget?.name ?? ""}
        busy={!!pinTarget && busyId === pinTarget.id}
        serverError={pinConfirmError}
        onClearServerError={() => setPinConfirmError(null)}
        onClose={closePinModal}
        onConfirm={(pin) => void confirmChangePin(pin)}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Desactivar miembro"
        description={`¿Desactivar a ${shortDisplayName(deactivateTarget?.name ?? "este miembro")}? No podrá entrar con su PIN.`}
        confirmLabel="Desactivar"
        busyLabel="Desactivando…"
        busy={!!deactivateTarget && busyId === deactivateTarget.id}
        error={deactivateError}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => {
          if (deactivateTarget && busyId === deactivateTarget.id) return;
          setDeactivateTarget(null);
          setDeactivateError(null);
        }}
      />

      <ConfirmDialog
        open={!!activateTarget}
        title="Activar miembro"
        description={`¿Activar a ${shortDisplayName(activateTarget?.name ?? "este miembro")}? Podrá entrar con su PIN.`}
        confirmLabel="Activar"
        busyLabel="Activando…"
        tone="neutral"
        busy={!!activateTarget && busyId === activateTarget.id}
        error={activateError}
        onConfirm={() => void confirmActivate()}
        onCancel={() => {
          if (activateTarget && busyId === activateTarget.id) return;
          setActivateTarget(null);
          setActivateError(null);
        }}
      />

      <ConfirmDialog
        open={handoffBlockOpen && !!pendingHandoff}
        title="PIN pendiente de entrega"
        description={
          handoffUndo && !pinHandoff
            ? `El PIN de ${shortDisplayName(pendingHandoff?.memberName ?? "este miembro")} aún está en pantalla. Vuelve a la entrega antes de seguir.`
            : `Entrega el PIN de ${shortDisplayName(pendingHandoff?.memberName ?? "este miembro")} antes de seguir.`
        }
        confirmLabel="Ir a la entrega"
        cancelLabel="Cancelar"
        tone="neutral"
        onConfirm={focusPendingHandoff}
        onCancel={() => setHandoffBlockOpen(false)}
      />

      <ConfirmDialog
        open={leaveConfirmOpen && !!pendingHandoff}
        title={HANDOFF_LEAVE_TITLE}
        description={
          pendingHandoff
            ? `El PIN de ${shortDisplayName(pendingHandoff.memberName)} aún no se cerró. ${HANDOFF_LEAVE_DESC}`
            : HANDOFF_LEAVE_DESC
        }
        confirmLabel="Salir de todas formas"
        cancelLabel="Quedarme"
        tone="danger"
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          clearPendingPinSurface();
          const proceed = leaveProceedRef.current;
          leaveProceedRef.current = null;
          proceed?.();
        }}
        onCancel={() => {
          setLeaveConfirmOpen(false);
          leaveProceedRef.current = null;
        }}
      />
    </div>
  );
}

function PinHandoffCard({
  handoff,
  copied,
  copyError,
  dismissButtonRef,
  pinRef,
  onDismiss,
  onCopy,
}: {
  handoff: PinHandoff;
  copied: boolean;
  copyError: string | null;
  dismissButtonRef: RefObject<HTMLButtonElement | null>;
  pinRef: RefObject<HTMLParagraphElement | null>;
  onDismiss: () => void;
  onCopy: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    sectionRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
    // Digits first so the PIN is announced before the dismiss control.
    pinRef.current?.focus();
  }, [pinRef, handoff.kind, handoff.memberName, handoff.pin]);

  const outcome =
    handoff.kind === "create"
      ? `${handoff.memberName} ya puede entrar.`
      : `PIN nuevo de ${handoff.memberName}.`;

  return (
    <section
      ref={sectionRef}
      id="team-pin-handoff-surface"
      role="status"
      aria-live="polite"
      aria-labelledby="team-pin-handoff-title"
      className={`${stickySurface} rounded-2xl border border-warn/40 bg-warn-muted px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-5`}
    >
      <h2
        id="team-pin-handoff-title"
        className="text-base font-bold tracking-tight text-warn-ink"
      >
        Entrega de acceso
      </h2>
      <p className="mt-1 text-sm text-warn-ink/80">{outcome}</p>
      <p
        ref={pinRef}
        tabIndex={-1}
        className="mt-3 w-fit max-w-full rounded-lg text-3xl font-bold tracking-[0.35em] text-warn-ink tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-warn-muted sm:text-4xl"
        aria-label={`PIN ${handoff.pin.split("").join(" ")}`}
      >
        {handoff.pin}
      </p>
      <p className="mt-2 text-xs font-medium text-warn-ink/80">
        Acceso con PIN → su nombre → este PIN. {LOST_PIN_RECOVERY}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          ref={dismissButtonRef}
          type="button"
          className={`${btnPrimary} w-full sm:w-auto`}
          onClick={onDismiss}
        >
          Ya se lo dije
        </button>
        <button
          type="button"
          className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-warn/40 bg-background/85 px-4 text-sm font-semibold text-warn-ink transition-colors hover:bg-background disabled:opacity-50 sm:w-auto ${focusRing}`}
          onClick={onCopy}
          aria-live="polite"
        >
          {copied ? "PIN copiado" : "Copiar PIN"}
        </button>
      </div>
      {copyError ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {copyError}
        </p>
      ) : null}
    </section>
  );
}

function PinHandoffUndoBar({
  handoff,
  copied,
  copyError,
  remainingMs,
  totalMs,
  onUndo,
  onCommit,
  onExtend,
  onCopy,
}: {
  handoff: PinHandoff;
  copied: boolean;
  copyError: string | null;
  remainingMs: number;
  totalMs: number;
  onUndo: () => void;
  onCommit: () => void;
  onExtend: () => void;
  onCopy: () => void;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressPct = Math.max(
    0,
    Math.min(100, totalMs > 0 ? (remainingMs / totalMs) * 100 : 0),
  );

  useEffect(() => {
    // Prefer recovery so Enter does not burn the last chance to re-show the PIN.
    undoRef.current?.focus();
  }, [handoff.memberId, handoff.pin]);

  return (
    <section
      id="team-pin-handoff-surface"
      role="status"
      aria-live="polite"
      aria-labelledby="team-pin-handoff-undo-title"
      className={`${stickySurface} rounded-2xl border border-warn/40 bg-warn-muted px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-5`}
    >
      <h2
        id="team-pin-handoff-undo-title"
        className="text-sm font-bold tracking-tight text-warn-ink"
      >
        PIN aún disponible
      </h2>

      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm text-warn-ink">
          <span className="font-semibold">{handoff.memberName}</span>
          {" · "}
          <span className="font-bold tracking-[0.3em] tabular-nums">
            {handoff.pin}
          </span>
        </p>
        <button
          type="button"
          className={`${btnLink} text-warn-ink hover:text-warn-ink`}
          onClick={onCopy}
          aria-live="polite"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {copyError ? (
        <p
          role="alert"
          className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {copyError}
        </p>
      ) : null}

      {/* Mobile: primary recovery in thumb zone (DOM first → visual bottom via reverse). */}
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          ref={undoRef}
          type="button"
          className={`${btnPrimary} w-full sm:w-auto`}
          onClick={onUndo}
        >
          Volver a la entrega
        </button>
        <button
          type="button"
          className={`${btnLink} min-h-11 self-center px-2 text-warn-ink/80 hover:text-warn-ink sm:self-auto`}
          onClick={onCommit}
        >
          Cerrar PIN
        </button>
      </div>

      <div className="mt-3">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-warn/25"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
          aria-label={`PIN disponible ${secondsLeft} segundos`}
        >
          <div
            className="h-full rounded-full bg-warn transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs font-medium text-warn-ink/80">
            {secondsLeft}s · luego{" "}
            <span className="font-semibold">Cambiar PIN</span>
          </p>
          <button
            type="button"
            className={`${btnLink} min-h-9 text-warn-ink hover:text-warn-ink`}
            onClick={onExtend}
          >
            Más tiempo
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyRoster({
  onAdd,
  disabled = false,
}: {
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/70 px-6 py-16 text-center">
      <h2 className="text-lg font-bold tracking-tight">Sin equipo todavía</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Agrega el primero y entrégale su PIN para Acceso con PIN.
      </p>
      <button
        type="button"
        className={`mt-5 ${btnPrimary}`}
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus className="size-4" aria-hidden />
        Agregar miembro
      </button>
    </div>
  );
}

function NoRosterMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">Sin coincidencias.</p>
      <button type="button" className={btnQuiet} onClick={onClear}>
        Ver todo el equipo
      </button>
    </div>
  );
}

function PendingPinChip({
  onReveal,
  className = "",
}: {
  onReveal: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onReveal}
      aria-label="Ver entrega de PIN pendiente"
      className={`${chipClass} min-h-11 bg-warn-muted px-3 py-1.5 text-warn-ink underline-offset-2 transition-colors hover:underline ${focusRing} ${className}`}
    >
      PIN pendiente · Ver
    </button>
  );
}

function MemberRowActions({
  member,
  busyAction,
  align = "end",
  onChangePin,
  onDeactivate,
  onActivate,
}: {
  member: StaffMemberResponse;
  busyAction: "pin" | "activate" | "deactivate" | null;
  align?: "start" | "end";
  onChangePin: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}) {
  const busy = busyAction !== null;
  return (
    <div
      className={
        align === "start"
          ? "flex w-full flex-col gap-2 [&>button]:w-full"
          : "flex flex-wrap items-center justify-end gap-x-1 gap-y-2"
      }
    >
      <button
        type="button"
        className={btnSecondary}
        disabled={busy}
        title={LOST_PIN_RECOVERY}
        aria-label={`Cambiar PIN de ${member.name}. ${LOST_PIN_RECOVERY}`}
        onClick={onChangePin}
      >
        <KeyRound className="size-4 shrink-0" aria-hidden />
        {busyAction === "pin" ? "Cambiando PIN…" : "Cambiar PIN"}
      </button>
      {member.active ? (
        <button
          type="button"
          className={btnQuietDanger}
          disabled={busy}
          aria-label={`Desactivar a ${member.name}`}
          onClick={onDeactivate}
        >
          {busyAction === "deactivate" ? "Desactivando…" : "Desactivar"}
        </button>
      ) : (
        <button
          type="button"
          className={btnQuiet}
          disabled={busy}
          aria-label={`Activar a ${member.name}`}
          onClick={onActivate}
        >
          {busyAction === "activate" ? "Activando…" : "Activar"}
        </button>
      )}
    </div>
  );
}

function MemberFormModal({
  open,
  busy,
  existingNames,
  serverError,
  onClearServerError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  existingNames: string[];
  serverError: string | null;
  onClearServerError: () => void;
  onClose: () => void;
  onSubmit: (input: { name: string; role: StaffRole; pin: string }) => void;
}) {
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("MESERO");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const reviewDirty =
    step === "review" && name.trim().length > 0 && isStaffPinFormat(pin);

  function requestClose() {
    if (busy) return;
    if (reviewDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  const panelRef = useModalFocusTrap({
    open,
    onEscape: requestClose,
    escapeEnabled: !busy && !discardOpen,
  });

  useEffect(() => {
    if (!open) {
      setStep("edit");
      setName("");
      setRole("MESERO");
      setPin("");
      setPinConfirm("");
      setShowPin(false);
      setLocalError(null);
      setDiscardOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const alertMessage = localError ?? serverError;
  const pinType = showPin ? "text" : "password";
  const roleLabel =
    ROLE_OPTIONS.find((opt) => opt.value === role)?.label ?? role;
  const trimmedName = name.trim();

  function clearFieldErrors() {
    if (localError) setLocalError(null);
    if (serverError) onClearServerError();
  }

  function goToReview(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("El nombre es obligatorio.");
      return;
    }
    if (existingNames.some((existing) => namesMatch(existing, trimmed))) {
      setLocalError(
        "Ya hay un miembro con ese nombre. Usa un apodo o apellido para distinguirlos.",
      );
      return;
    }
    const pinError = staffPinCreateError(pin);
    if (pinError) {
      setLocalError(pinError);
      return;
    }
    if (pin !== pinConfirm) {
      setLocalError("El PIN y la confirmación no coinciden. Escríbelos de nuevo.");
      return;
    }
    setLocalError(null);
    onClearServerError();
    setStep("review");
  }

  function backToEdit() {
    if (busy) return;
    clearFieldErrors();
    setDiscardOpen(false);
    setStep("edit");
  }

  function confirmCreate() {
    if (busy) return;
    onSubmit({ name: trimmedName, role, pin });
  }

  function confirmDiscard() {
    setDiscardOpen(false);
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) requestClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-member-modal-title"
          aria-describedby={
            alertMessage
              ? "team-member-modal-error team-member-modal-desc"
              : "team-member-modal-desc"
          }
          className={modalPanel}
        >
          <h2
            id="team-member-modal-title"
            className="text-lg font-bold tracking-tight"
          >
            Agregar miembro
          </h2>
          <p
            id="team-member-modal-desc"
            className="mt-1 text-sm text-muted-foreground"
          >
            {step === "edit"
              ? "Alta nueva: PIN dos veces y revisión. Si se olvida después, Cambiar PIN es más rápido."
              : "Última mirada al PIN. Al confirmar, pasa a la entrega en pantalla."}
          </p>

          {step === "edit" ? (
            <form className="mt-4 flex flex-col gap-4" onSubmit={goToReview}>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Nombre
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldErrors();
                  }}
                  maxLength={100}
                  disabled={busy}
                  placeholder="Ej. María López"
                  aria-invalid={localError === "El nombre es obligatorio."}
                  className={fieldInputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Rol
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as StaffRole);
                    clearFieldErrors();
                  }}
                  disabled={busy}
                  aria-describedby="team-member-role-hint"
                  className={fieldInputClass}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span
                  id="team-member-role-hint"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {ROLE_OPTIONS.find((opt) => opt.value === role)?.access}
                </span>
              </label>
              <fieldset className="flex flex-col gap-4 border-0 p-0">
                <legend className="sr-only">PIN de acceso</legend>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-sm font-semibold">PIN</span>
                  <button
                    type="button"
                    className={btnLink}
                    disabled={busy}
                    aria-pressed={showPin}
                    onClick={() => setShowPin((v) => !v)}
                  >
                    {showPin ? "Ocultar PIN" : "Mostrar PIN"}
                  </button>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  <span className="sr-only">PIN</span>
                  <input
                    type={pinType}
                    value={pin}
                    onChange={(e) => {
                      setPin(normalizePin(e.target.value));
                      clearFieldErrors();
                    }}
                    inputMode="numeric"
                    pattern={`\\d{${STAFF_PIN_LENGTH}}`}
                    maxLength={STAFF_PIN_LENGTH}
                    disabled={busy}
                    autoComplete="new-password"
                    placeholder="••••"
                    aria-invalid={
                      !!localError &&
                      localError.includes("PIN") &&
                      !localError.includes("coinciden")
                    }
                    className={pinInputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Confirmar PIN
                  <input
                    type={pinType}
                    value={pinConfirm}
                    onChange={(e) => {
                      setPinConfirm(normalizePin(e.target.value));
                      clearFieldErrors();
                    }}
                    inputMode="numeric"
                    pattern={`\\d{${STAFF_PIN_LENGTH}}`}
                    maxLength={STAFF_PIN_LENGTH}
                    disabled={busy}
                    autoComplete="new-password"
                    placeholder="••••"
                    aria-invalid={
                      localError ===
                      "El PIN y la confirmación no coinciden. Escríbelos de nuevo."
                    }
                    className={pinInputClass}
                  />
                </label>
              </fieldset>
              {alertMessage ? (
                <p
                  id="team-member-modal-error"
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {alertMessage}
                </p>
              ) : null}
              <div className={modalActions}>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button type="submit" className={btnPrimary} disabled={busy}>
                  Revisar PIN
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-secondary/60 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {trimmedName}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {roleLabel}
                </p>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">
                  PIN que vas a entregar
                </p>
                <p className="mt-1 text-3xl font-bold tracking-[0.35em] text-foreground tabular-nums">
                  {pin}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Si no es el correcto, vuelve a editarlo.
                </p>
              </div>
              {alertMessage ? (
                <p
                  id="team-member-modal-error"
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {alertMessage}
                </p>
              ) : null}
              <div className={`${modalActions} mt-0`}>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy}
                  onClick={backToEdit}
                >
                  Volver a editar
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy}
                  onClick={confirmCreate}
                >
                  {busy ? "Agregando…" : "Agregar miembro"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title={DISCARD_REVIEW_TITLE}
        description={DISCARD_REVIEW_DESC}
        confirmLabel="Descartar PIN"
        cancelLabel="Seguir revisando"
        tone="danger"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}

function PinFormModal({
  open,
  memberName,
  busy,
  serverError,
  onClearServerError,
  onClose,
  onConfirm,
}: {
  open: boolean;
  memberName: string;
  busy: boolean;
  serverError: string | null;
  onClearServerError: () => void;
  onClose: () => void;
  onConfirm: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  /** Ready-to-deliver PIN: confirm before discarding a mistap close. */
  const pinReady = isStaffPinFormat(pin);

  function requestClose() {
    if (busy) return;
    if (pinReady) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  const panelRef = useModalFocusTrap({
    open,
    onEscape: requestClose,
    escapeEnabled: !busy && !discardOpen,
  });

  useEffect(() => {
    if (!open) {
      setPin("");
      setShowPin(true);
      setLocalError(null);
      setDiscardOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const pinType = showPin ? "text" : "password";
  const alertMessage = localError ?? serverError;

  function clearErrors() {
    if (localError) setLocalError(null);
    if (serverError) onClearServerError();
  }

  function submitPin(e: React.FormEvent) {
    e.preventDefault();
    const pinError = staffPinCreateError(pin);
    if (pinError) {
      setLocalError(pinError);
      return;
    }
    setLocalError(null);
    onClearServerError();
    onConfirm(pin);
  }

  function confirmDiscard() {
    setDiscardOpen(false);
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) requestClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-pin-modal-title"
          aria-describedby={
            alertMessage
              ? "team-pin-modal-error team-pin-modal-desc"
              : "team-pin-modal-desc"
          }
          className={modalPanel}
        >
          <h2
            id="team-pin-modal-title"
            className="text-lg font-bold tracking-tight"
          >
            Cambiar PIN
          </h2>
          <p
            id="team-pin-modal-desc"
            className="mt-1 text-sm text-muted-foreground"
          >
            <span className="font-semibold text-foreground">{memberName}</span>
            {" — "}
            Acceso olvidado o no entregado: un solo PIN, vista grande y entrega.
            Sin paso de revisión. El actual dejará de servir.
          </p>

          <form className="mt-4 flex flex-col gap-4" onSubmit={submitPin}>
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-semibold">PIN</span>
              <button
                type="button"
                className={btnLink}
                aria-pressed={showPin}
                disabled={busy}
                onClick={() => setShowPin((v) => !v)}
              >
                {showPin ? "Ocultar PIN" : "Mostrar PIN"}
              </button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              <span className="sr-only">PIN</span>
              <input
                type={pinType}
                value={pin}
                onChange={(e) => {
                  setPin(normalizePin(e.target.value));
                  clearErrors();
                }}
                inputMode="numeric"
                pattern={`\\d{${STAFF_PIN_LENGTH}}`}
                maxLength={STAFF_PIN_LENGTH}
                autoComplete="new-password"
                autoFocus
                disabled={busy}
                aria-invalid={!!localError && localError.includes("dígitos")}
                className={pinInputClass}
              />
            </label>

            <div
              className="rounded-xl border border-border bg-secondary/60 px-4 py-3"
              aria-live="polite"
            >
              <p className="text-xs font-semibold text-muted-foreground">
                PIN que vas a entregar
              </p>
              <p
                className={`mt-1 text-3xl font-bold tracking-[0.35em] tabular-nums ${
                  pin.length > 0 ? "text-foreground" : "text-muted-foreground/50"
                }`}
                aria-label={
                  pin.length > 0
                    ? showPin
                      ? `PIN ${pin.split("").join(" ")}`
                      : `PIN con ${pin.length} dígitos`
                    : "PIN vacío"
                }
              >
                {pin.length === 0
                  ? "····"
                  : showPin
                    ? pin
                    : "•".repeat(pin.length)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Mira bien estos dígitos: al continuar vas directo a la entrega.
              </p>
            </div>

            {alertMessage ? (
              <p
                id="team-pin-modal-error"
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {alertMessage}
              </p>
            ) : null}

            <div className={modalActions}>
              <button
                type="button"
                className={btnSecondary}
                disabled={busy}
                onClick={requestClose}
              >
                Cancelar
              </button>
              <button type="submit" className={btnPrimary} disabled={busy}>
                {busy ? "Cambiando PIN…" : "Entregar PIN nuevo"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title={DISCARD_REVIEW_TITLE}
        description={DISCARD_REVIEW_DESC}
        confirmLabel="Descartar PIN"
        cancelLabel="Seguir editando"
        tone="danger"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}
