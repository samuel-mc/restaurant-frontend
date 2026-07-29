"use client";

/**
 * CRUD de cupones para SuperAdmin (Billing).
 */

import { useState, useTransition, type FormEvent } from "react";
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

const fieldClassName =
  "w-full rounded-xl border border-white/[0.08] bg-[#0c0c0e] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50";

const selectClassName =
  "rounded-lg border border-white/10 bg-[#0c0c0e] px-2 py-1.5 text-xs font-medium text-zinc-200 outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50";

function formatUsages(coupon: SuperAdminCoupon): string {
  if (coupon.maxRedemptions == null) {
    return `${coupon.redemptionCount} / ∞`;
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
  const [busyId, setBusyId] = useState<number | "create" | null>(null);
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

  function refresh() {
    startTransition(() => router.refresh());
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
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo crear el cupón.",
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
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo actualizar el cupón.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(coupon: SuperAdminCoupon) {
    if (busyId != null) return;
    setBusyId(coupon.id);
    setError(null);
    try {
      const updated = await updateSuperAdminCoupon(coupon.id, {
        active: !coupon.active,
      });
      setCoupons((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo cambiar el estado del cupón.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5">
        <h2 className="text-sm font-semibold text-white">Crear cupón</h2>
        <p className="mt-1 text-xs text-zinc-500">
          El código no se puede cambiar después. Usa desactivar para retirar un
          cupón.
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
              onChange={(e) => setGrantsPlan(e.target.value as SuperAdminPlan)}
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
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busyId === "create" ? "Creando…" : "Crear cupón"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Cupones</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {coupons.length} cupón{coupons.length === 1 ? "" : "es"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Usos</th>
                <th className="px-4 py-3 font-medium">Expira</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {coupons.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    Aún no hay cupones.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
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
                          <p className="mt-1 text-xs text-zinc-500">
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
                            placeholder="∞"
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
                            coupon.active ? "text-emerald-300" : "text-zinc-500"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              coupon.active ? "bg-emerald-400" : "bg-zinc-600"
                            }`}
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
                                className="rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
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
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08] disabled:opacity-40"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={busyId != null}
                                onClick={() => void toggleActive(coupon)}
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08] disabled:opacity-40"
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
    </div>
  );
}
