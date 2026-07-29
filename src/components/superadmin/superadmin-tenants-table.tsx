"use client";

/**
 * Tabla global de tenants + plan/pago + suspender/activar + impersonación.
 * Acciones de alto riesgo pasan por SuperAdminConfirmDialog.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search, X } from "lucide-react";
import type {
  SuperAdminPaymentStatus,
  SuperAdminPlan,
  SuperAdminTenant,
} from "@/types/superadmin";
import {
  impersonateTenant,
  updateTenantActiveStatus,
  updateTenantSubscription,
} from "@/services/superadminService";
import { ApiError } from "@/services/apiClient";
import { SuperAdminConfirmDialog } from "@/components/superadmin/superadmin-confirm-dialog";
import {
  saAlertError,
  saAlertSuccess,
  saFocus,
  saSecondaryBtn,
  saSelect,
} from "@/components/superadmin/superadmin-ui";

function buildTenantAdminUrl(slug: string, path: string): string {
  if (typeof window === "undefined") {
    return `http://${slug}.localhost:3000${path}`;
  }
  const { protocol, hostname, port } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1";
  if (isLocal) {
    const portSuffix = port ? `:${port}` : "";
    return `${protocol}//${slug}.localhost${portSuffix}${path}`;
  }
  const root =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() || "tusass.com";
  return `${protocol}//${slug}.${root}${path}`;
}

function asPlan(value: string): SuperAdminPlan {
  return value === "PRO" ? "PRO" : "BASIC";
}

function asPayment(value: string): SuperAdminPaymentStatus {
  return value === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "ACTIVE";
}

function planLabel(plan: SuperAdminPlan): string {
  return plan === "PRO" ? "Pro" : "Básico";
}

function paymentLabel(status: SuperAdminPaymentStatus): string {
  return status === "PENDING_PAYMENT" ? "Pago pendiente" : "Al corriente";
}

const selectClassName = saSelect;

type StatusFilter = "all" | "active" | "suspended" | "pending_payment";

type PendingAction =
  | { kind: "suspend"; tenant: SuperAdminTenant }
  | { kind: "activate"; tenant: SuperAdminTenant }
  | {
      kind: "plan";
      tenant: SuperAdminTenant;
      plan: SuperAdminPlan;
    }
  | {
      kind: "payment";
      tenant: SuperAdminTenant;
      paymentStatus: SuperAdminPaymentStatus;
    }
  | { kind: "impersonate"; tenant: SuperAdminTenant };

export function SuperAdminTenantsTable({
  initialTenants,
}: {
  initialTenants: SuperAdminTenant[];
}) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4500);
    return () => window.clearTimeout(t);
  }, [success]);

  const filterCounts = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let pendingPayment = 0;
    for (const t of tenants) {
      if (t.active) active += 1;
      else suspended += 1;
      if (asPayment(t.paymentStatus) === "PENDING_PAYMENT") pendingPayment += 1;
    }
    return { active, suspended, pendingPayment, all: tenants.length };
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter === "active" && !t.active) return false;
      if (statusFilter === "suspended" && t.active) return false;
      if (
        statusFilter === "pending_payment" &&
        asPayment(t.paymentStatus) !== "PENDING_PAYMENT"
      ) {
        return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.subdomain.toLowerCase().includes(q) ||
        t.plan.toLowerCase().includes(q)
      );
    });
  }, [tenants, query, statusFilter]);

  function flashSuccess(message: string) {
    setSuccess(message);
    setError(null);
  }

  function isRowBusy(tenantId: number): boolean {
    return busyId === tenantId;
  }

  async function applyActive(tenant: SuperAdminTenant, nextActive: boolean) {
    if (isRowBusy(tenant.id)) return;
    setBusyId(tenant.id);
    setDialogError(null);
    setError(null);
    try {
      const updated = await updateTenantActiveStatus(tenant.id, nextActive);
      setTenants((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      setPending(null);
      flashSuccess(
        nextActive
          ? `${updated.name} quedó activo otra vez.`
          : `${updated.name} quedó suspendido. Los comensales no podrán operar.`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el estado. Revisa la conexión e inténtalo de nuevo.";
      setDialogError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function applySubscription(
    tenant: SuperAdminTenant,
    next: { plan?: SuperAdminPlan; paymentStatus?: SuperAdminPaymentStatus },
  ) {
    if (isRowBusy(tenant.id)) return;
    const plan = next.plan ?? asPlan(tenant.plan);
    const paymentStatus = next.paymentStatus ?? asPayment(tenant.paymentStatus);
    if (
      plan === asPlan(tenant.plan) &&
      paymentStatus === asPayment(tenant.paymentStatus)
    ) {
      setPending(null);
      return;
    }

    setBusyId(tenant.id);
    setDialogError(null);
    setError(null);
    try {
      const updated = await updateTenantSubscription(tenant.id, {
        plan,
        paymentStatus,
      });
      setTenants((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      setPending(null);
      if (next.plan != null) {
        flashSuccess(
          `Plan de ${updated.name} → ${planLabel(asPlan(updated.plan))}.`,
        );
      } else {
        flashSuccess(
          `Cobro de ${updated.name} → ${paymentLabel(asPayment(updated.paymentStatus))}.`,
        );
      }
      startTransition(() => router.refresh());
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar la suscripción. Revisa la conexión e inténtalo de nuevo.";
      setDialogError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function applyImpersonate(tenant: SuperAdminTenant) {
    if (isRowBusy(tenant.id) || !tenant.active) return;
    setBusyId(tenant.id);
    setDialogError(null);
    setError(null);
    try {
      const result = await impersonateTenant(tenant.id);
      const base = buildTenantAdminUrl(result.tenantSlug, "/admin/impersonate");
      window.location.assign(`${base}#${encodeURIComponent(result.token)}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo abrir el panel del restaurante. Puede estar suspendido o falló el token de soporte.";
      setDialogError(message);
      setBusyId(null);
    }
  }

  function confirmPending() {
    if (!pending) return;
    switch (pending.kind) {
      case "suspend":
        void applyActive(pending.tenant, false);
        break;
      case "activate":
        void applyActive(pending.tenant, true);
        break;
      case "plan":
        void applySubscription(pending.tenant, { plan: pending.plan });
        break;
      case "payment":
        void applySubscription(pending.tenant, {
          paymentStatus: pending.paymentStatus,
        });
        break;
      case "impersonate":
        void applyImpersonate(pending.tenant);
        break;
    }
  }

  function cancelPending() {
    if (busyId != null) return;
    setPending(null);
    setDialogError(null);
  }

  const dialogBusy = pending != null && busyId === pending.tenant.id;

  const dialogCopy = ((): {
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    tone: "danger" | "neutral";
    challenge?: string;
  } | null => {
    if (!pending) return null;
    const name = pending.tenant.name;
    const slug = pending.tenant.subdomain;
    switch (pending.kind) {
      case "suspend":
        return {
          title: `¿Suspender ${name}?`,
          description: `El restaurante ${name} (${slug}) dejará de operar en su subdominio hasta que lo reactives. Los comensales y el panel del local quedarán bloqueados.`,
          confirmLabel: "Suspender restaurante",
          busyLabel: "Suspendiendo…",
          tone: "danger",
          challenge: slug,
        };
      case "activate":
        return {
          title: `¿Reactivar ${name}?`,
          description: `Se restablecerá el acceso al subdominio ${slug} y al panel del restaurante.`,
          confirmLabel: "Reactivar restaurante",
          busyLabel: "Reactivando…",
          tone: "neutral",
        };
      case "plan":
        return {
          title: `¿Cambiar plan de ${name}?`,
          description: `Pasará de ${planLabel(asPlan(pending.tenant.plan))} a ${planLabel(pending.plan)}. Esto afecta límites de menú y el acceso al sitio institucional Pro.`,
          confirmLabel: `Cambiar a ${planLabel(pending.plan)}`,
          busyLabel: "Guardando…",
          tone: "neutral",
        };
      case "payment":
        return {
          title: `¿Actualizar cobro de ${name}?`,
          description: `El estado de cobro pasará de «${paymentLabel(asPayment(pending.tenant.paymentStatus))}» a «${paymentLabel(pending.paymentStatus)}».`,
          confirmLabel: "Guardar cobro",
          busyLabel: "Guardando…",
          tone: "neutral",
        };
      case "impersonate":
        return {
          title: `¿Abrir el panel de ${name}?`,
          description: `Saldrás de SuperAdmin y entrarás al panel de ${name} (${slug}) con un token de soporte. Cuando termines, cierra esa sesión; no hay regreso automático aquí.`,
          confirmLabel: "Salir y abrir panel",
          busyLabel: "Abriendo…",
          tone: "danger",
        };
    }
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, subdominio o plan…"
            aria-label="Buscar restaurantes por nombre, subdominio o plan"
            className={`w-full rounded-xl border border-white/[0.08] bg-[#111113] py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 ${saFocus}`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 ${saFocus}`}
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar por estado"
        >
          {(
            [
              { id: "all", label: "Todos", count: filterCounts.all },
              { id: "active", label: "Activos", count: filterCounts.active },
              {
                id: "suspended",
                label: "Suspendidos",
                count: filterCounts.suspended,
              },
              {
                id: "pending_payment",
                label: "Pago pendiente",
                count: filterCounts.pendingPayment,
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
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${saFocus} ${
                  selected
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
                }`}
              >
                {chip.label}
                <span className="tabular-nums opacity-70">{chip.count}</span>
              </button>
            );
          })}
        </div>
      </div>

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

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs font-medium tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Restaurante</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Cobro</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    {query.trim() || statusFilter !== "all" ? (
                      <span className="inline-flex flex-col items-center gap-3">
                        <span>
                          Ningún restaurante coincide con los filtros actuales.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("all");
                          }}
                          className={`${saSecondaryBtn} ${saFocus}`}
                        >
                          Quitar filtros
                        </button>
                      </span>
                    ) : (
                      "Todavía no hay restaurantes registrados."
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => {
                  const busy = isRowBusy(tenant.id);
                  const pendingPlan =
                    pending?.kind === "plan" && pending.tenant.id === tenant.id
                      ? pending.plan
                      : null;
                  const pendingPayment =
                    pending?.kind === "payment" &&
                    pending.tenant.id === tenant.id
                      ? pending.paymentStatus
                      : null;
                  return (
                    <tr key={tenant.id} className="hover:bg-white/[0.02]">
                      <td className="max-w-[16rem] min-w-0 px-4 py-3.5">
                        <p
                          className="truncate font-medium text-white"
                          title={tenant.name}
                        >
                          {tenant.name}
                        </p>
                        <p
                          className="mt-0.5 truncate font-mono text-xs text-zinc-500"
                          title={tenant.subdomain}
                        >
                          {tenant.subdomain}
                        </p>
                        {tenant.websitePublished ? (
                          <p className="mt-1 text-xs text-emerald-400/80">
                            Sitio publicado
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-zinc-600">
                            Sitio no publicado
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          aria-label={`Plan de ${tenant.name}`}
                          className={selectClassName}
                          disabled={busy}
                          value={pendingPlan ?? asPlan(tenant.plan)}
                          onChange={(e) => {
                            const plan = e.target.value as SuperAdminPlan;
                            if (plan === asPlan(tenant.plan)) return;
                            setDialogError(null);
                            setPending({ kind: "plan", tenant, plan });
                          }}
                        >
                          <option value="BASIC">Básico</option>
                          <option value="PRO">Pro</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          aria-label={`Cobro de ${tenant.name}`}
                          className={selectClassName}
                          disabled={busy}
                          value={
                            pendingPayment ?? asPayment(tenant.paymentStatus)
                          }
                          onChange={(e) => {
                            const paymentStatus = e.target
                              .value as SuperAdminPaymentStatus;
                            if (
                              paymentStatus === asPayment(tenant.paymentStatus)
                            ) {
                              return;
                            }
                            setDialogError(null);
                            setPending({
                              kind: "payment",
                              tenant,
                              paymentStatus,
                            });
                          }}
                        >
                          <option value="ACTIVE">Al corriente</option>
                          <option value="PENDING_PAYMENT">
                            Pago pendiente
                          </option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            tenant.active ? "text-emerald-300" : "text-zinc-500"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              tenant.active ? "bg-emerald-400" : "bg-zinc-600"
                            }`}
                            aria-hidden
                          />
                          {tenant.active ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs text-zinc-400">
                            <span className="whitespace-nowrap">
                              {tenant.active ? "Suspender" : "Activar"}
                            </span>
                            <input
                              type="checkbox"
                              role="switch"
                              aria-checked={tenant.active}
                              aria-label={
                                tenant.active
                                  ? `Suspender ${tenant.name}`
                                  : `Activar ${tenant.name}`
                              }
                              checked={tenant.active}
                              disabled={busy}
                              onChange={() => {
                                setDialogError(null);
                                setPending({
                                  kind: tenant.active ? "suspend" : "activate",
                                  tenant,
                                });
                              }}
                              className="peer sr-only"
                            />
                            <span
                              className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                                tenant.active
                                  ? "bg-emerald-500/80"
                                  : "bg-zinc-700"
                              } ${busy ? "opacity-50" : ""}`}
                              aria-hidden
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition ${
                                  tenant.active ? "translate-x-4" : ""
                                }`}
                              />
                            </span>
                          </label>
                          <button
                            type="button"
                            disabled={busy || !tenant.active}
                            onClick={() => {
                              setDialogError(null);
                              setPending({ kind: "impersonate", tenant });
                            }}
                            className={`${saSecondaryBtn} ${saFocus}`}
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            Abrir panel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-zinc-600">
        {filtered.length} de {tenants.length} restaurantes
      </p>

      {dialogCopy && pending ? (
        <SuperAdminConfirmDialog
          open
          title={dialogCopy.title}
          description={dialogCopy.description}
          confirmLabel={dialogCopy.confirmLabel}
          busyLabel={dialogCopy.busyLabel}
          tone={dialogCopy.tone}
          challenge={dialogCopy.challenge}
          busy={dialogBusy}
          error={dialogError}
          onConfirm={confirmPending}
          onCancel={cancelPending}
        />
      ) : null}
    </div>
  );
}
