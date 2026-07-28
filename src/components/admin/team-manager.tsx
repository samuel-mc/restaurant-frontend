"use client";

/**
 * Gestión de equipo: listado, alta, activar/desactivar y cambio de PIN.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, KeyRound } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { getAdminErrorMessage } from "@/lib/admin-error";
import {
  createTeamMember,
  deactivateTeamMember,
  updateTeamMember,
} from "@/services/adminTeamService";
import type { StaffMemberResponse, StaffRole } from "@/types/api";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const btnPrimary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 ${focusRing}`;
const btnSecondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50 ${focusRing}`;

const pinInputClass = `min-h-11 rounded-xl border border-border bg-secondary px-3 font-medium tracking-[0.3em] ${focusRing}`;

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: "MESERO", label: "Mesero" },
  { value: "COCINA", label: "Cocina" },
  { value: "ADMIN", label: "Admin" },
];

/**
 * Badges de rol = categoría, no alarma.
 * `warn` queda para atención ahora (offline, pendientes, busy).
 */
function roleBadge(role: StaffRole): { label: string; className: string } {
  switch (role) {
    case "ADMIN":
      return {
        label: "Admin",
        className: "bg-primary/15 text-primary",
      };
    case "MESERO":
      return {
        label: "Mesero",
        className: "bg-live-muted text-live-ink",
      };
    case "COCINA":
      return {
        label: "Cocina",
        className: "border border-border bg-secondary text-foreground",
      };
  }
}

function normalizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

interface TeamManagerProps {
  tenantSlug: string;
  initialMembers: StaffMemberResponse[];
}

export function TeamManager({ tenantSlug, initialMembers }: TeamManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [modalOpen, setModalOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<StaffMemberResponse | null>(null);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    useState<StaffMemberResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pinFormError, setPinFormError] = useState<string | null>(null);
  const [pinConfirmError, setPinConfirmError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      }),
    [members],
  );

  async function handleCreate(input: {
    name: string;
    role: StaffRole;
    pin: string;
  }) {
    setCreateError(null);
    setBusyId("create");
    try {
      const created = await createTeamMember(tenantSlug, input);
      setMembers((prev) => [...prev, created]);
      setModalOpen(false);
    } catch (err) {
      setCreateError(
        getAdminErrorMessage(err, "No se pudo agregar al miembro. Revisa e intenta de nuevo."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(member: StaffMemberResponse) {
    setListError(null);
    setBusyId(member.id);
    try {
      const updated = await updateTeamMember(tenantSlug, member.id, {
        active: !member.active,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? updated : m)),
      );
    } catch (err) {
      setListError(
        getAdminErrorMessage(
          err,
          "No se pudo actualizar el estado. Intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmChangePin() {
    if (!pinTarget || !pendingPin) return;
    setPinConfirmError(null);
    setBusyId(pinTarget.id);
    try {
      const updated = await updateTeamMember(tenantSlug, pinTarget.id, {
        pin: pendingPin,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === pinTarget.id ? updated : m)),
      );
      setPendingPin(null);
      setPinTarget(null);
      setPinFormError(null);
    } catch (err) {
      setPinConfirmError(
        getAdminErrorMessage(
          err,
          "No se pudo cambiar el PIN. Intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
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
    } catch (err) {
      setDeactivateError(
        getAdminErrorMessage(
          err,
          "No se pudo desactivar al miembro. Intenta de nuevo.",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  function openCreateModal() {
    setListError(null);
    setCreateError(null);
    setModalOpen(true);
  }

  function openPinModal(member: StaffMemberResponse) {
    setListError(null);
    setPinFormError(null);
    setPinConfirmError(null);
    setPendingPin(null);
    setPinTarget(member);
  }

  function closePinModal() {
    if (busyId) return;
    setPinTarget(null);
    setPendingPin(null);
    setPinFormError(null);
    setPinConfirmError(null);
  }

  function openDeactivate(member: StaffMemberResponse) {
    setListError(null);
    setDeactivateError(null);
    setDeactivateTarget(member);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona meseros, cocina y admins con acceso rápido por PIN.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={openCreateModal}>
          <Plus className="size-4" aria-hidden />
          Agregar miembro
        </button>
      </header>

      {listError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {listError}
        </p>
      ) : null}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Aún no hay miembros. Agrega el primero con un PIN de 4
                  dígitos.
                </td>
              </tr>
            ) : (
              sorted.map((member) => {
                const badge = roleBadge(member.role);
                const rowBusy = busyId === member.id;
                return (
                  <tr key={member.id} className="border-t border-border/80">
                    <td className="max-w-[14rem] px-4 py-3 font-semibold">
                      <span className="block truncate" title={member.name}>
                        {member.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.active
                            ? "bg-live-muted text-live-ink"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {member.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={rowBusy}
                          onClick={() => openPinModal(member)}
                        >
                          <KeyRound className="size-4" aria-hidden />
                          PIN
                        </button>
                        {member.active ? (
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={rowBusy}
                            onClick={() => openDeactivate(member)}
                          >
                            {rowBusy ? "Guardando…" : "Desactivar"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={rowBusy}
                            onClick={() => void handleToggleActive(member)}
                          >
                            {rowBusy ? "Guardando…" : "Activar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {sorted.length === 0 ? (
          <li className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay miembros. Agrega el primero con un PIN de 4 dígitos.
          </li>
        ) : (
          sorted.map((member) => {
            const badge = roleBadge(member.role);
            const rowBusy = busyId === member.id;
            return (
              <li
                key={member.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold" title={member.name}>
                      {member.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.active
                            ? "bg-live-muted text-live-ink"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {member.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={rowBusy}
                    onClick={() => openPinModal(member)}
                  >
                    Cambiar PIN
                  </button>
                  {member.active ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={rowBusy}
                      onClick={() => openDeactivate(member)}
                    >
                      {rowBusy ? "Guardando…" : "Desactivar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={rowBusy}
                      onClick={() => void handleToggleActive(member)}
                    >
                      {rowBusy ? "Guardando…" : "Activar"}
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <MemberFormModal
        open={modalOpen}
        busy={busyId === "create"}
        serverError={createError}
        onClose={() => {
          if (busyId) return;
          setModalOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreate}
      />

      <PinFormModal
        open={!!pinTarget && pendingPin === null}
        memberName={pinTarget?.name ?? ""}
        busy={false}
        serverError={pinFormError}
        onClose={closePinModal}
        onSubmit={(pin) => {
          setPinFormError(null);
          setPinConfirmError(null);
          setPendingPin(pin);
        }}
      />

      <ConfirmDialog
        open={!!pinTarget && pendingPin !== null}
        title="Cambiar PIN"
        description={`¿Cambiar el PIN de ${pinTarget?.name ?? "este miembro"}? El PIN anterior dejará de funcionar de inmediato.`}
        confirmLabel="Cambiar PIN"
        busyLabel="Guardando…"
        tone="danger"
        busy={!!pinTarget && busyId === pinTarget.id}
        error={pinConfirmError}
        onConfirm={() => void confirmChangePin()}
        onCancel={() => {
          if (busyId) return;
          setPendingPin(null);
          setPinConfirmError(null);
        }}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Desactivar miembro"
        description={`¿Desactivar a ${deactivateTarget?.name ?? "este miembro"}? Ya no podrá entrar con su PIN.`}
        confirmLabel="Desactivar"
        busyLabel="Guardando…"
        busy={!!deactivateTarget && busyId === deactivateTarget.id}
        error={deactivateError}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => {
          if (busyId) return;
          setDeactivateTarget(null);
          setDeactivateError(null);
        }}
      />
    </div>
  );
}

function MemberFormModal({
  open,
  busy,
  serverError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (input: { name: string; role: StaffRole; pin: string }) => void;
}) {
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onClose,
    escapeEnabled: !busy,
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("MESERO");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setRole("MESERO");
      setPin("");
      setPinConfirm("");
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  const alertMessage = localError ?? serverError;

  function resetAndClose() {
    setName("");
    setRole("MESERO");
    setPin("");
    setPinConfirm("");
    setLocalError(null);
    onClose();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("El nombre es obligatorio.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setLocalError("El PIN debe ser exactamente 4 dígitos.");
      return;
    }
    if (pin !== pinConfirm) {
      setLocalError("Los PIN no coinciden. Escríbelos de nuevo.");
      return;
    }
    setLocalError(null);
    onSubmit({ name: trimmed, role, pin });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) resetAndClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-member-modal-title"
        aria-describedby={alertMessage ? "team-member-modal-error" : undefined}
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl"
      >
        <h2
          id="team-member-modal-title"
          className="text-lg font-bold tracking-tight"
        >
          Agregar miembro
        </h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={busy}
              placeholder="Ej. Juan — Cocinero 1"
              aria-invalid={localError === "El nombre es obligatorio."}
              className={`min-h-11 rounded-xl border border-border bg-secondary px-3 font-medium ${focusRing}`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Rol
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              disabled={busy}
              className={`min-h-11 rounded-xl border border-border bg-secondary px-3 font-medium ${focusRing}`}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            PIN (4 dígitos)
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(normalizePin(e.target.value))}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              disabled={busy}
              autoComplete="new-password"
              placeholder="••••"
              aria-invalid={
                !!localError && localError.includes("PIN") && !localError.includes("coinciden")
              }
              className={pinInputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Confirmar PIN
            <input
              type="password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(normalizePin(e.target.value))}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              disabled={busy}
              autoComplete="new-password"
              placeholder="••••"
              aria-invalid={localError === "Los PIN no coinciden. Escríbelos de nuevo."}
              className={pinInputClass}
            />
          </label>
          {alertMessage ? (
            <p
              id="team-member-modal-error"
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {alertMessage}
            </p>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={resetAndClose}
            >
              Cancelar
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PinFormModal({
  open,
  memberName,
  busy,
  serverError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  memberName: string;
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}) {
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onClose,
    escapeEnabled: !busy,
  });
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPin("");
      setPinConfirm("");
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  const alertMessage = localError ?? serverError;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setLocalError("El PIN debe ser exactamente 4 dígitos.");
      return;
    }
    if (pin !== pinConfirm) {
      setLocalError("Los PIN no coinciden. Escríbelos de nuevo.");
      return;
    }
    setLocalError(null);
    onSubmit(pin);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-pin-modal-title"
        aria-describedby="team-pin-modal-desc"
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl"
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
          el PIN actual dejará de servir en cuanto confirmes el cambio.
        </p>
        <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Nuevo PIN
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(normalizePin(e.target.value))}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              disabled={busy}
              autoComplete="new-password"
              aria-invalid={
                !!localError &&
                localError.includes("4 dígitos")
              }
              className={pinInputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Confirmar nuevo PIN
            <input
              type="password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(normalizePin(e.target.value))}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              disabled={busy}
              autoComplete="new-password"
              aria-invalid={localError === "Los PIN no coinciden. Escríbelos de nuevo."}
              className={pinInputClass}
            />
          </label>
          {alertMessage ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {alertMessage}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className={btnPrimary} disabled={busy}>
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
