"use client";

/**
 * CRUD de cupones para SuperAdmin.
 */

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  SuperAdminCoupon,
  SuperAdminPlan,
} from "@/types/superadmin";
import {
  createSuperAdminCoupon,
  updateSuperAdminCoupon,
} from "@/services/superadminService";
import { ApiError } from "@/services/apiClient";
import {
  COUPON_RISK_WINDOW_DAYS,
  isCouponAtRisk,
  isCouponExhausted,
  isCouponExpiringSoon,
} from "@/lib/superadmin-attention";
import { SuperAdminConfirmDialog } from "@/components/superadmin/superadmin-confirm-dialog";
import { MutationReviewDetail } from "@/components/superadmin/superadmin-mutation-review";
import {
  CouponActiveBadge,
  CouponEditFields,
  CouponRowActions,
  CouponSummaryFacts,
  formatCouponExpires,
  formatCouponUsages,
  planGrantLabel,
  usagesDraftLabel,
} from "@/components/superadmin/superadmin-coupon-fields";
import {
  saAlertError,
  saAlertSuccess,
  saChip,
  saChipOff,
  saChipOn,
  saField,
  saFocus,
  saPrimaryBtn,
  saSecondaryBtn,
} from "@/components/superadmin/superadmin-ui";

type CouponStatusFilter = "all" | "active" | "inactive";
type CouponRiskFilter = "all" | "any" | "expiring" | "exhausted";

type PendingCreate = {
  code: string;
  description: string;
  grantsPlan: SuperAdminPlan;
  maxRedemptions: string;
  expiresLocal: string;
};

type PendingEdit = {
  coupon: SuperAdminCoupon;
  description: string;
  grantsPlan: SuperAdminPlan;
  max: string;
  expiresLocal: string;
};

function parseRiskFilter(raw: string | null): CouponRiskFilter {
  if (raw === "any" || raw === "expiring" || raw === "exhausted") return raw;
  return "all";
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

function parsePositiveMax(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const max = Number.parseInt(raw, 10);
  if (!Number.isFinite(max) || max < 1) {
    throw new Error("El máximo de usos debe ser un número positivo.");
  }
  return max;
}

function buildEditReviewRows(pending: PendingEdit) {
  const { coupon } = pending;
  const rows: { label: string; from: string; to: string }[] = [];
  const nextDesc = pending.description.trim();
  const prevDesc = (coupon.description ?? "").trim();
  if (nextDesc !== prevDesc) {
    rows.push({
      label: "Descripción",
      from: prevDesc || "(vacía)",
      to: nextDesc || "(vacía)",
    });
  }
  const prevPlan = coupon.grantsPlan === "BASIC" ? "BASIC" : "PRO";
  if (pending.grantsPlan !== prevPlan) {
    rows.push({
      label: "Plan",
      from: planGrantLabel(prevPlan),
      to: planGrantLabel(pending.grantsPlan),
    });
  }
  const prevMax =
    coupon.maxRedemptions == null ? "" : String(coupon.maxRedemptions);
  if (pending.max.trim() !== prevMax) {
    rows.push({
      label: "Máx. usos",
      from: usagesDraftLabel(prevMax),
      to: usagesDraftLabel(pending.max),
    });
  }
  const prevExp = isoToLocalInput(coupon.expiresAt);
  if (pending.expiresLocal.trim() !== prevExp) {
    rows.push({
      label: "Expira",
      from: formatCouponExpires(coupon.expiresAt),
      to: pending.expiresLocal.trim()
        ? formatCouponExpires(
            localInputToIso(pending.expiresLocal) ?? pending.expiresLocal,
          )
        : "Sin expiración",
    });
  }
  return rows;
}

export function SuperAdminCouponsPanel({
  initialCoupons,
}: {
  initialCoupons: SuperAdminCoupon[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "create" | null>(null);
  const [pendingToggle, setPendingToggle] = useState<SuperAdminCoupon | null>(
    null,
  );
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(
    null,
  );
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
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
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<CouponRiskFilter>(() =>
    parseRiskFilter(searchParams.get("risk")),
  );
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setCoupons(initialCoupons);
  }, [initialCoupons]);

  useEffect(() => {
    setRiskFilter(parseRiskFilter(searchParams.get("risk")));
  }, [searchParams]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4500);
    return () => window.clearTimeout(t);
  }, [success]);

  function applyRiskFilter(next: CouponRiskFilter) {
    setRiskFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("risk");
    } else {
      params.set("risk", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const nowMs = Date.now();

  const filterCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let atRisk = 0;
    for (const c of coupons) {
      if (c.active) active += 1;
      else inactive += 1;
      if (isCouponAtRisk(c, nowMs, COUPON_RISK_WINDOW_DAYS)) atRisk += 1;
    }
    return { all: coupons.length, active, inactive, atRisk };
  }, [coupons, nowMs]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (statusFilter === "active" && !c.active) return false;
      if (statusFilter === "inactive" && c.active) return false;
      if (riskFilter === "any") {
        return isCouponAtRisk(c, nowMs, COUPON_RISK_WINDOW_DAYS);
      }
      if (riskFilter === "expiring") {
        return isCouponExpiringSoon(c, nowMs, COUPON_RISK_WINDOW_DAYS);
      }
      if (riskFilter === "exhausted") {
        return isCouponExhausted(c);
      }
      return true;
    });
  }, [coupons, statusFilter, riskFilter, nowMs]);

  function clearFilters() {
    setStatusFilter("all");
    applyRiskFilter("all");
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  function flashSuccess(message: string) {
    setSuccess(message);
    setError(null);
  }

  function requestCreate(e: FormEvent) {
    e.preventDefault();
    if (busyId != null) return;
    setError(null);
    try {
      parsePositiveMax(maxRedemptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revisa el máximo de usos.");
      return;
    }
    setDialogError(null);
    setPendingCreate({
      code: code.trim(),
      description: description.trim(),
      grantsPlan,
      maxRedemptions,
      expiresLocal,
    });
  }

  async function confirmCreate() {
    if (!pendingCreate || busyId != null) return;
    setBusyId("create");
    setDialogError(null);
    setError(null);
    try {
      const max = parsePositiveMax(pendingCreate.maxRedemptions);
      const expiresAt = localInputToIso(pendingCreate.expiresLocal);
      const created = await createSuperAdminCoupon({
        code: pendingCreate.code,
        description: pendingCreate.description || undefined,
        grantsPlan: pendingCreate.grantsPlan,
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
      setPendingCreate(null);
      flashSuccess(`Cupón ${created.code} creado.`);
      refresh();
    } catch (err) {
      setDialogError(
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

  function requestSaveEdit(coupon: SuperAdminCoupon) {
    if (busyId != null) return;
    setError(null);
    try {
      parsePositiveMax(editMax);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revisa el máximo de usos.");
      return;
    }
    const draft: PendingEdit = {
      coupon,
      description: editDescription,
      grantsPlan: editPlan,
      max: editMax,
      expiresLocal: editExpires,
    };
    const rows = buildEditReviewRows(draft);
    if (rows.length === 0) {
      setError("Sin cambios para guardar.");
      return;
    }
    setDialogError(null);
    setPendingEdit(draft);
  }

  async function confirmEdit() {
    if (!pendingEdit || busyId != null) return;
    const couponId = pendingEdit.coupon.id;
    setBusyId(couponId);
    setDialogError(null);
    setError(null);
    try {
      const clearMax = pendingEdit.max.trim() === "";
      const max = clearMax ? undefined : parsePositiveMax(pendingEdit.max);
      const expiresRaw = pendingEdit.expiresLocal.trim();
      const updated = await updateSuperAdminCoupon(couponId, {
        description: pendingEdit.description.trim(),
        grantsPlan: pendingEdit.grantsPlan,
        ...(clearMax
          ? { clearMaxRedemptions: true }
          : { maxRedemptions: max }),
        expiresAt: expiresRaw === "" ? "" : (localInputToIso(expiresRaw) ?? ""),
      });
      setCoupons((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setEditingId(null);
      setPendingEdit(null);
      flashSuccess(`Cupón ${updated.code} actualizado.`);
      refresh();
    } catch (err) {
      setDialogError(
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

  function editFieldsFor(coupon: SuperAdminCoupon) {
    const busy = busyId === coupon.id;
    return (
      <CouponEditFields
        description={editDescription}
        plan={editPlan}
        max={editMax}
        expires={editExpires}
        busy={busy}
        onDescription={setEditDescription}
        onPlan={setEditPlan}
        onMax={setEditMax}
        onExpires={setEditExpires}
        onSave={() => requestSaveEdit(coupon)}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  const createReviewDetail: ReactNode = pendingCreate ? (
    <MutationReviewDetail
      rows={[
        { label: "Código", from: "—", to: pendingCreate.code },
        {
          label: "Plan",
          from: "—",
          to: planGrantLabel(pendingCreate.grantsPlan),
        },
        {
          label: "Máx. usos",
          from: "—",
          to: usagesDraftLabel(pendingCreate.maxRedemptions),
        },
        {
          label: "Expira",
          from: "—",
          to: pendingCreate.expiresLocal.trim()
            ? formatCouponExpires(
                localInputToIso(pendingCreate.expiresLocal) ??
                  pendingCreate.expiresLocal,
              )
            : "Sin expiración",
        },
        ...(pendingCreate.description
          ? [
              {
                label: "Descripción",
                from: "—",
                to: pendingCreate.description,
              },
            ]
          : []),
      ]}
      note="El código no se podrá editar después."
    />
  ) : null;

  const editReviewDetail: ReactNode =
    pendingEdit != null ? (
      <MutationReviewDetail
        rows={buildEditReviewRows(pendingEdit)}
        note={pendingEdit.coupon.code}
      />
    ) : null;

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
              { id: "all" as const, label: "Todos", count: filterCounts.all },
              {
                id: "active" as const,
                label: "Activos",
                count: filterCounts.active,
              },
              {
                id: "inactive" as const,
                label: "Inactivos",
                count: filterCounts.inactive,
              },
            ] as const
          ).map((chip) => {
            const selected = statusFilter === chip.id && riskFilter === "all";
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setStatusFilter(chip.id);
                  if (riskFilter !== "all") applyRiskFilter("all");
                }}
                className={`${saChip} ${saFocus} ${
                  selected ? saChipOn : saChipOff
                }`}
              >
                {chip.label}
                <span className="tabular-nums opacity-70">{chip.count}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={riskFilter !== "all"}
            onClick={() => {
              setStatusFilter("all");
              applyRiskFilter(riskFilter !== "all" ? "all" : "any");
            }}
            className={`${saChip} ${saFocus} ${
              riskFilter !== "all" ? saChipOn : saChipOff
            }`}
          >
            {riskFilter === "expiring"
              ? "Por expirar"
              : riskFilter === "exhausted"
                ? "Usos agotados"
                : "En riesgo"}
            <span className="tabular-nums opacity-70">
              {riskFilter === "expiring"
                ? coupons.filter((c) =>
                    isCouponExpiringSoon(c, nowMs, COUPON_RISK_WINDOW_DAYS),
                  ).length
                : riskFilter === "exhausted"
                  ? coupons.filter((c) => isCouponExhausted(c)).length
                  : filterCounts.atRisk}
            </span>
          </button>
        </div>
      </div>

      {createOpen ? (
        <section
          id="create-coupon-panel"
          className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5"
        >
          <h2 className="text-sm font-semibold text-white">Crear cupón</h2>
          <p className="mt-1 text-xs text-zinc-400">
            El código queda fijo al crearlo. Revisarás el resumen antes de
            confirmar. Para retirarlo del registro, usa Desactivar.
          </p>
          <form
            onSubmit={requestCreate}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-xs font-medium text-zinc-400">Código</span>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PRO-DEMO-2026"
                className={`${saField} font-mono`}
                disabled={busyId != null}
                maxLength={40}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">
                Plan que otorga
              </span>
              <select
                className={saField}
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
                className={saField}
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
                className={saField}
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
                className={saField}
                disabled={busyId != null}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busyId != null || code.trim().length < 3}
                className={`${saPrimaryBtn} ${saFocus}`}
              >
                Revisar cupón
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
              ? statusFilter === "all" && riskFilter === "all"
                ? "Ninguno todavía"
                : "Ninguno con este filtro"
              : riskFilter !== "all"
                ? `${filteredCoupons.length} en este filtro · ${coupons.length} en total`
                : `${filteredCoupons.length} visibles · ${coupons.length} en total`}
          </p>
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">
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
                  onClick={clearFilters}
                  className={`${saSecondaryBtn} ${saFocus}`}
                >
                  Ver todos
                </button>
              </span>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-white/[0.04] md:hidden">
              {filteredCoupons.map((coupon) => {
                const editing = editingId === coupon.id;
                return (
                  <li key={coupon.id} className="space-y-3 p-4">
                    {!editing ? (
                      <CouponSummaryFacts coupon={coupon} />
                    ) : (
                      <p className="font-mono text-sm font-medium text-white">
                        {coupon.code}
                      </p>
                    )}
                    {editing ? (
                      editFieldsFor(coupon)
                    ) : (
                      <CouponRowActions
                        coupon={coupon}
                        disabled={busyId != null}
                        onEdit={() => startEdit(coupon)}
                        onToggle={() => {
                          setDialogError(null);
                          setPendingToggle(coupon);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
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
                  {filteredCoupons.map((coupon) => {
                    const editing = editingId === coupon.id;
                    return (
                      <Fragment key={coupon.id}>
                        <tr
                          className={`align-top hover:bg-white/[0.02] ${
                            editing ? "bg-white/[0.03]" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <CouponSummaryFacts
                              coupon={coupon}
                              showMeta={false}
                            />
                          </td>
                          <td className="px-4 py-3.5 text-xs font-medium text-zinc-300">
                            {planGrantLabel(coupon.grantsPlan)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-zinc-400">
                            {formatCouponUsages(coupon)}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-zinc-400">
                            {formatCouponExpires(coupon.expiresAt)}
                          </td>
                          <td className="px-4 py-3.5">
                            <CouponActiveBadge active={coupon.active} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex justify-end">
                              {editing ? (
                                <button
                                  type="button"
                                  disabled={busyId === coupon.id}
                                  onClick={() => setEditingId(null)}
                                  className={`${saSecondaryBtn} ${saFocus}`}
                                >
                                  Cerrar
                                </button>
                              ) : (
                                <CouponRowActions
                                  coupon={coupon}
                                  disabled={busyId != null}
                                  onEdit={() => startEdit(coupon)}
                                  onToggle={() => {
                                    setDialogError(null);
                                    setPendingToggle(coupon);
                                  }}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                        {editing ? (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={6} className="px-4 py-4">
                              {editFieldsFor(coupon)}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {pendingCreate ? (
        <SuperAdminConfirmDialog
          open
          title={`¿Crear cupón ${pendingCreate.code}?`}
          description="Revisa el resumen. Al confirmar, el código queda fijo y podrá usarse en registros nuevos."
          detail={createReviewDetail}
          confirmLabel="Crear cupón"
          busyLabel="Creando…"
          tone="neutral"
          busy={busyId === "create"}
          error={dialogError}
          onConfirm={() => void confirmCreate()}
          onCancel={() => {
            if (busyId === "create") return;
            setPendingCreate(null);
            setDialogError(null);
          }}
        />
      ) : null}

      {pendingEdit ? (
        <SuperAdminConfirmDialog
          open
          title={`¿Guardar cambios en ${pendingEdit.coupon.code}?`}
          description="Solo se aplican los campos que cambian. Los canjes ya hechos no se revierten."
          detail={editReviewDetail}
          confirmLabel="Guardar cambios"
          busyLabel="Guardando…"
          tone="neutral"
          busy={busyId === pendingEdit.coupon.id}
          error={dialogError}
          onConfirm={() => void confirmEdit()}
          onCancel={() => {
            if (busyId === pendingEdit.coupon.id) return;
            setPendingEdit(null);
            setDialogError(null);
          }}
        />
      ) : null}

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
          detail={
            <MutationReviewDetail
              rows={[
                {
                  label: "Estado",
                  from: pendingToggle.active ? "Activo" : "Inactivo",
                  to: pendingToggle.active ? "Inactivo" : "Activo",
                },
              ]}
              note={pendingToggle.code}
            />
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
