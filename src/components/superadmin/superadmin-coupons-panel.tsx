"use client";

/**
 * CRUD de cupones para SuperAdmin.
 */

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  SuperAdminCoupon,
  SuperAdminPlan,
} from "@/types/superadmin";
import {
  createSuperAdminCoupon,
  updateSuperAdminCoupon,
} from "@/services/superadminService";
import { ApiError } from "@/services/apiClient";
import { SuperAdminConfirmDialog } from "@/components/superadmin/superadmin-confirm-dialog";
import {
  saAlertError,
  saAlertSuccess,
  saChip,
  saChipOff,
  saChipOn,
  saDangerBtn,
  saField,
  saFocus,
  saPrimaryBtn,
  saSecondaryBtn,
  saSelect,
  saSoftSuccessBtn,
} from "@/components/superadmin/superadmin-ui";

const fieldClassName = saField;
const selectClassName = saSelect;

type CouponFilter = "all" | "active" | "inactive";

function formatUsages(coupon: SuperAdminCoupon): string {
  if (coupon.maxRedemptions == null) {
    return `${coupon.redemptionCount} / ilimitado`;
  }
  return `${coupon.redemptionCount} / ${coupon.maxRedemptions}`;
}

function formatExpires(expiresAt: string | null): string {
  if (!expiresAt) return "Sin expiración";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return expiresAt;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Convierte datetime-local (local) a ISO-8601 con offset. */
function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SuperAdminCouponsPanel({
  initialCoupons,
}: {
  initialCoupons: SuperAdminCoupon[];
}) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "create" | null>(null);
  const [pendingToggle, setPendingToggle] = useState<SuperAdminCoupon | null>(
    null,
  );
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [grantsPlan, setGrantsPlan] = useState<SuperAdminPlan>("PRO");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editPlan, setEditPlan] = useState<SuperAdminPlan>("PRO");
  const [editMax, setEditMax] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setCoupons(initialCoupons);
  }, [initialCoupons]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4500);
    return () => window.clearTimeout(t);
  }, [success]);

  const filterCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const c of coupons) {
      if (c.active) active += 1;
      else inactive += 1;
    }
    return { all: coupons.length, active, inactive };
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    if (statusFilter === "active") return coupons.filter((c) => c.active);
    if (statusFilter === "inactive") return coupons.filter((c) => !c.active);
    return coupons;
  }, [coupons, statusFilter]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function flashSuccess(message: string) {
    setSuccess(message);
    setError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (busyId != null) return;
    setBusyId("create");
    setError(null);
    try {
      const max =
        maxRedemptions.trim() === ""
          ? undefined
          : Number.parseInt(maxRedemptions, 10);
      if (max != null && (!Number.isFinite(max) || max < 1)) {
        throw new Error("El máximo de usos debe ser un número positivo.");
      }
      const expiresAt = localInputToIso(expiresLocal);
      const created = await createSuperAdminCoupon({
        code: code.trim(),
        description: description.trim() || undefined,
        grantsPlan,
        maxRedemptions: max,
        expiresAt: expiresAt ?? undefined,
      });
      setCoupons((prev) => [created, ...prev]);
      setCode("");
      setDescription("");
      setGrantsPlan("PRO");
      setMaxRedemptions("");
      setExpiresLocal("");
      setCreateOpen(false);
      flashSuccess(`Cupón ${created.code} creado.`);
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo crear el cupón. Revisa el código e inténtalo de nuevo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(coupon: SuperAdminCoupon) {
    setEditingId(coupon.id);
    setEditDescription(coupon.description ?? "");
    setEditPlan(coupon.grantsPlan === "BASIC" ? "BASIC" : "PRO");
    setEditMax(
      coupon.maxRedemptions == null ? "" : String(coupon.maxRedemptions),
    );
    setEditExpires(isoToLocalInput(coupon.expiresAt));
    setError(null);
  }

  async function saveEdit(couponId: number) {
    if (busyId != null) return;
    setBusyId(couponId);
    setError(null);
    try {
      const clearMax = editMax.trim() === "";
      const max = clearMax ? undefined : Number.parseInt(editMax, 10);
      if (!clearMax && (max == null || !Number.isFinite(max) || max < 1)) {
        throw new Error("El máximo de usos debe ser un número positivo.");
      }
      const expiresRaw = editExpires.trim();
      const updated = await updateSuperAdminCoupon(couponId, {
        description: editDescription.trim(),
        grantsPlan: editPlan,
        ...(clearMax
          ? { clearMaxRedemptions: true }
          : { maxRedemptions: max }),
        expiresAt: expiresRaw === "" ? "" : (localInputToIso(expiresRaw) ?? ""),
      });
      setCoupons((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setEditingId(null);
      flashSuccess(`Cupón ${updated.code} actualizado.`);
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo actualizar el cupón. Revisa los campos e inténtalo de nuevo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function applyToggleActive(coupon: SuperAdminCoupon) {
    if (busyId === coupon.id) return;
    setBusyId(coupon.id);
    setDialogError(null);
    setError(null);
    try {
      const updated = await updateSuperAdminCoupon(coupon.id, {
        active: !coupon.active,
      });
      setCoupons((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setPendingToggle(null);
      flashSuccess(
        updated.active
          ? `Cupón ${updated.code} reactivado.`
          : `Cupón ${updated.code} desactivado. Ya no se puede canjear.`,
      );
      refresh();
    } catch (err) {
      setDialogError(
        err instanceof ApiError
          ? err.message
          : "No se pudo cambiar el estado del cupón. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p role="alert" className={saAlertError}>
          {error}
        </p>
      ) : null}

      {success ? (
        <p role="status" className={saAlertSuccess}>
          {success}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          aria-expanded={createOpen}
          aria-controls="create-coupon-panel"
          onClick={() => setCreateOpen((o) => !o)}
          className={`${saPrimaryBtn} ${saFocus} w-full sm:w-auto`}
        >
          {createOpen ? "Cerrar formulario" : "Nuevo cupón"}
        </button>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar cupones por estado"
        >
          {(
            [
              { id: "all", label: "Todos", count: filterCounts.all },
              { id: "active", label: "Activos", count: filterCounts.active },
              {
                id: "inactive",
                label: "Inactivos",
                count: filterCounts.inactive,
              },
            ] as const
          ).map((chip) => {
            const selected = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setStatusFilter(chip.id)}
                className={`${saChip} ${saFocus} ${
                  selected ? saChipOn : saChipOff
                }`}
              >
                {chip.label}
                <span className="tabular-nums opacity-70">{chip.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {createOpen ? (
        <section
          id="create-coupon-panel"
          className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5"
        >
          <h2 className="text-sm font-semibold text-white">Crear cupón</h2>
          <p className="mt-1 text-xs text-zinc-400">
            El código queda fijo al crearlo. Para retirarlo del registro, usa
            Desactivar (no se borra el historial de canjes).
          </p>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-xs font-medium text-zinc-400">Código</span>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PRO-DEMO-2026"
                className={`${fieldClassName} font-mono`}
                disabled={busyId != null}
                maxLength={40}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                Plan que otorga
              </span>
              <select
                className={`${fieldClassName}`}
                value={grantsPlan}
                onChange={(e) =>
                  setGrantsPlan(e.target.value as SuperAdminPlan)
                }
                disabled={busyId != null}
              >
                <option value="PRO">Pro</option>
                <option value="BASIC">Básico</option>
              </select>
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-zinc-400">
                Descripción (opcional)
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Pago en efectivo / early access"
                className={fieldClassName}
                disabled={busyId != null}
                maxLength={255}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                Máx. usos (vacío = ilimitado)
              </span>
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                className={fieldClassName}
                disabled={busyId != null}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                Expira (opcional)
              </span>
              <input
                type="datetime-local"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
                className={fieldClassName}
                disabled={busyId != null}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busyId != null || code.trim().length < 3}
                className={`${saPrimaryBtn} ${saFocus}`}
              >
                {busyId === "create" ? "Creando…" : "Crear cupón"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Todos los cupones</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {filteredCoupons.length === 0
              ? statusFilter === "all"
                ? "Ninguno todavía"
                : "Ninguno con este filtro"
              : `${filteredCoupons.length} visibles · ${coupons.length} en total`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs font-medium tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Expira</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-zinc-400"
                  >
                    {coupons.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-3">
                        <span>Aún no hay cupones.</span>
                        <button
                          type="button"
                          onClick={() => setCreateOpen(true)}
                          className={`${saSecondaryBtn} ${saFocus}`}
                        >
                          Crear el primero
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex flex-col items-center gap-3">
                        <span>Ningún cupón coincide con el filtro.</span>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("all")}
                          className={`${saSecondaryBtn} ${saFocus}`}
                        >
                          Ver todos
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => {
                  const busy = busyId === coupon.id;
                  const editing = editingId === coupon.id;
                  return (
                    <tr key={coupon.id} className="align-top hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-sm font-medium text-white">
                          {coupon.code}
                        </p>
                        {editing ? (
                          <input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className={`${fieldClassName} mt-2`}
                            placeholder="Descripción"
                            disabled={busy}
                            maxLength={255}
                          />
                        ) : coupon.description ? (
                          <p className="mt-1 text-xs text-zinc-400">
                            {coupon.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        {editing ? (
                          <select
                            className={selectClassName}
                            value={editPlan}
                            onChange={(e) =>
                              setEditPlan(e.target.value as SuperAdminPlan)
                            }
                            disabled={busy}
                          >
                            <option value="PRO">Pro</option>
                            <option value="BASIC">Básico</option>
                          </select>
                        ) : (
                          <span className="text-xs font-medium text-zinc-300">
                            {coupon.grantsPlan === "PRO" ? "Pro" : "Básico"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {editing ? (
                          <input
                            type="number"
                            min={1}
                            value={editMax}
                            onChange={(e) => setEditMax(e.target.value)}
                            placeholder="Ilimitado"
                            className={`${fieldClassName} max-w-[7rem]`}
                            disabled={busy}
                          />
                        ) : (
                          <span className="font-mono text-xs text-zinc-400">
                            {formatUsages(coupon)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {editing ? (
                          <input
                            type="datetime-local"
                            value={editExpires}
                            onChange={(e) => setEditExpires(e.target.value)}
                            className={fieldClassName}
                            disabled={busy}
                          />
                        ) : (
                          <span className="text-xs text-zinc-400">
                            {formatExpires(coupon.expiresAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            coupon.active ? "text-emerald-300" : "text-zinc-400"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              coupon.active ? "bg-emerald-400" : "bg-zinc-600"
                            }`}
                            aria-hidden
                          />
                          {coupon.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {editing ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void saveEdit(coupon.id)}
                                className={`${saPrimaryBtn} px-3 text-xs ${saFocus}`}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setEditingId(null)}
                                className={`${saSecondaryBtn} ${saFocus}`}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busyId != null}
                                onClick={() => startEdit(coupon)}
                                className={`${saSecondaryBtn} ${saFocus}`}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={busyId != null}
                                onClick={() => {
                                  setDialogError(null);
                                  setPendingToggle(coupon);
                                }}
                                className={`${
                                  coupon.active ? saDangerBtn : saSoftSuccessBtn
                                } ${saFocus}`}
                              >
                                {coupon.active ? "Desactivar" : "Activar"}
                              </button>
                            </>
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
      </section>

      {pendingToggle ? (
        <SuperAdminConfirmDialog
          open
          title={
            pendingToggle.active
              ? `¿Desactivar ${pendingToggle.code}?`
              : `¿Reactivar ${pendingToggle.code}?`
          }
          description={
            pendingToggle.active
              ? `El cupón ${pendingToggle.code} dejará de aceptarse en registros nuevos. Los canjes ya hechos no se revierten.`
              : `El cupón ${pendingToggle.code} volverá a poder canjearse (sujeto a usos y expiración).`
          }
          confirmLabel={pendingToggle.active ? "Desactivar cupón" : "Reactivar"}
          busyLabel={
            pendingToggle.active ? "Desactivando…" : "Reactivando…"
          }
          tone={pendingToggle.active ? "danger" : "neutral"}
          challenge={pendingToggle.active ? pendingToggle.code : null}
          busy={busyId === pendingToggle.id}
          error={dialogError}
          onConfirm={() => void applyToggleActive(pendingToggle)}
          onCancel={() => {
            if (busyId === pendingToggle.id) return;
            setPendingToggle(null);
            setDialogError(null);
          }}
        />
      ) : null}
    </div>
  );
}
