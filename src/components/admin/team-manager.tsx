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

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: "MESERO", label: "Mesero" },
  { value: "COCINA", label: "Cocina" },
  { value: "ADMIN", label: "Admin" },
];

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
        className: "bg-warn-muted text-warn-ink",
      };
  }
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setBusyId("create");
    try {
      const created = await createTeamMember(tenantSlug, input);
      setMembers((prev) => [...prev, created]);
      setModalOpen(false);
    } catch (err) {
      setError(getAdminErrorMessage(err, "No se pudo agregar al miembro."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(member: StaffMemberResponse) {
    setError(null);
    setBusyId(member.id);
    try {
      const updated = await updateTeamMember(tenantSlug, member.id, {
        active: !member.active,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? updated : m)),
      );
    } catch (err) {
      setError(getAdminErrorMessage(err, "No se pudo actualizar el estado."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangePin(member: StaffMemberResponse, pin: string) {
    setError(null);
    setBusyId(member.id);
    try {
      const updated = await updateTeamMember(tenantSlug, member.id, { pin });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? updated : m)),
      );
      setPinTarget(null);
    } catch (err) {
      setError(getAdminErrorMessage(err, "No se pudo cambiar el PIN."));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setError(null);
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
      setError(getAdminErrorMessage(err, "No se pudo desactivar el miembro."));
    } finally {
      setBusyId(null);
    }
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
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setError(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Agregar miembro
        </button>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
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
                return (
                  <tr
                    key={member.id}
                    className="border-t border-border/80"
                  >
                    <td className="px-4 py-3 font-semibold">{member.name}</td>
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
                          disabled={busyId === member.id}
                          onClick={() => setPinTarget(member)}
                        >
                          <KeyRound className="size-4" aria-hidden />
                          PIN
                        </button>
                        {member.active ? (
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={busyId === member.id}
                            onClick={() => setDeactivateTarget(member)}
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={busyId === member.id}
                            onClick={() => handleToggleActive(member)}
                          >
                            Activar
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
            return (
              <li
                key={member.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{member.name}</p>
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
                    disabled={busyId === member.id}
                    onClick={() => setPinTarget(member)}
                  >
                    Cambiar PIN
                  </button>
                  {member.active ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busyId === member.id}
                      onClick={() => setDeactivateTarget(member)}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busyId === member.id}
                      onClick={() => handleToggleActive(member)}
                    >
                      Activar
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
        onClose={() => !busyId && setModalOpen(false)}
        onSubmit={handleCreate}
      />

      <PinFormModal
        open={!!pinTarget}
        memberName={pinTarget?.name ?? ""}
        busy={!!pinTarget && busyId === pinTarget.id}
        onClose={() => !busyId && setPinTarget(null)}
        onSubmit={(pin) => {
          if (pinTarget) void handleChangePin(pinTarget, pin);
        }}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Desactivar miembro"
        description={`¿Desactivar a ${deactivateTarget?.name ?? "este miembro"}? Ya no podrá entrar con su PIN.`}
        confirmLabel="Desactivar"
        busy={!!deactivateTarget && busyId === deactivateTarget.id}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}

function MemberFormModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
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
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setRole("MESERO");
      setPin("");
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  function resetAndClose() {
    setName("");
    setRole("MESERO");
    setPin("");
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
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
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
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              disabled={busy}
              autoComplete="off"
              placeholder="••••"
              className={`min-h-11 rounded-xl border border-border bg-secondary px-3 font-medium tracking-[0.3em] ${focusRing}`}
            />
          </label>
          {localError ? (
            <p role="alert" className="text-sm text-destructive">
              {localError}
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
  onClose,
  onSubmit,
}: {
  open: boolean;
  memberName: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}) {
  const panelRef = useModalFocusTrap({
    open,
    onEscape: onClose,
    escapeEnabled: !busy,
  });
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPin("");
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setLocalError("El PIN debe ser exactamente 4 dígitos.");
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
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
      >
        <h2
          id="team-pin-modal-title"
          className="text-lg font-bold tracking-tight"
        >
          Cambiar PIN
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{memberName}</p>
        <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Nuevo PIN
            <input
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              disabled={busy}
              autoComplete="off"
              className={`min-h-11 rounded-xl border border-border bg-secondary px-3 font-medium tracking-[0.3em] ${focusRing}`}
            />
          </label>
          {localError ? (
            <p role="alert" className="text-sm text-destructive">
              {localError}
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
              {busy ? "Guardando…" : "Actualizar PIN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
