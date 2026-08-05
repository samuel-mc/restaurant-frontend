"use client";

/**
 * Directorio de restaurantes — filas destiladas:
 * resumen + «Gestionar»; mutaciones en panel expandido.
 */

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  Fragment,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
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
import { MutationReviewDetail } from "@/components/superadmin/superadmin-mutation-review";
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

function formatPeriodEnd(iso: string | null | undefined): string {
  if (!iso) return "Sin fecha de renovación";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** datetime-local (local) → ISO-8601. */
function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type StatusFilter = "all" | "active" | "suspended" | "pending_payment";
type SortKey = "name" | "plan" | "payment" | "status";
type SortDir = "asc" | "desc";

function parseStatusFilter(raw: string | null): StatusFilter {
  if (
    raw === "active" ||
    raw === "suspended" ||
    raw === "pending_payment"
  ) {
    return raw;
  }
  return "all";
}

function parseSortKey(raw: string | null): SortKey {
  if (raw === "plan" || raw === "payment" || raw === "status") return raw;
  return "name";
}

function parseSortDir(raw: string | null): SortDir {
  return raw === "desc" ? "desc" : "asc";
}

function compareTenants(
  a: SuperAdminTenant,
  b: SuperAdminTenant,
  key: SortKey,
  dir: SortDir,
): number {
  let cmp = 0;
  switch (key) {
    case "name":
      cmp = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      if (cmp === 0) {
        cmp = a.subdomain.localeCompare(b.subdomain, "es", {
          sensitivity: "base",
        });
      }
      break;
    case "plan":
      cmp = asPlan(a.plan).localeCompare(asPlan(b.plan));
      break;
    case "payment":
      cmp = asPayment(a.paymentStatus).localeCompare(
        asPayment(b.paymentStatus),
      );
      break;
    case "status":
      cmp = Number(b.active) - Number(a.active);
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

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
  | {
      kind: "period";
      tenant: SuperAdminTenant;
      /** ISO o "" para limpiar. */
      currentPeriodEnd: string;
    }
  | { kind: "impersonate"; tenant: SuperAdminTenant };

function TenantStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        active ? "text-emerald-300" : "text-zinc-400"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-zinc-600"
        }`}
        aria-hidden
      />
      {active ? "Activo" : "Suspendido"}
    </span>
  );
}

/** Hechos del restaurante compartidos entre card móvil y celdas de tabla. */
function TenantSummaryFacts({
  tenant,
  variant,
}: {
  tenant: SuperAdminTenant;
  variant: "card" | "table";
}) {
  const published = tenant.websitePublished
    ? "Sitio publicado"
    : "Sitio no publicado";

  if (variant === "card") {
    return (
      <div className="min-w-0">
        <p className="font-medium text-white">{tenant.name}</p>
        <p className="mt-0.5 font-mono text-xs text-zinc-400">
          {tenant.subdomain}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
          <span>{planLabel(asPlan(tenant.plan))}</span>
          <span>{paymentLabel(asPayment(tenant.paymentStatus))}</span>
          <TenantStatusBadge active={tenant.active} />
        </div>
        <p className="mt-1 text-xs text-zinc-400">{published}</p>
        <p className="mt-1 text-xs text-zinc-400">
          Renueva: {formatPeriodEnd(tenant.currentPeriodEnd)}
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="truncate font-medium text-white" title={tenant.name}>
        {tenant.name}
      </p>
      <p
        className="mt-0.5 truncate font-mono text-xs text-zinc-400"
        title={tenant.subdomain}
      >
        {tenant.subdomain}
      </p>
      <p
        className={`mt-1 text-xs ${
          tenant.websitePublished ? "text-emerald-400/80" : "text-zinc-400"
        }`}
      >
        {published}
      </p>
    </>
  );
}

function TenantManageFields({
  tenant,
  busy,
  pendingPlan,
  pendingPayment,
  onPlanChange,
  onPaymentChange,
  onPeriodChange,
  onSuspend,
  onActivate,
  onImpersonate,
}: {
  tenant: SuperAdminTenant;
  busy: boolean;
  pendingPlan: SuperAdminPlan | null;
  pendingPayment: SuperAdminPaymentStatus | null;
  onPlanChange: (plan: SuperAdminPlan) => void;
  onPaymentChange: (status: SuperAdminPaymentStatus) => void;
  onPeriodChange: (currentPeriodEnd: string) => void;
  onSuspend: () => void;
  onActivate: () => void;
  onImpersonate: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-[#0c0c0e] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Plan</span>
            <select
              aria-label={`Plan de ${tenant.name}`}
              className={`${saSelect} w-full`}
              disabled={busy}
              value={pendingPlan ?? asPlan(tenant.plan)}
              onChange={(e) => {
                const plan = e.target.value as SuperAdminPlan;
                if (plan === asPlan(tenant.plan)) return;
                onPlanChange(plan);
              }}
            >
              <option value="BASIC">Básico</option>
              <option value="PRO">Pro</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Cobro</span>
            <select
              aria-label={`Cobro de ${tenant.name}`}
              className={`${saSelect} w-full`}
              disabled={busy}
              value={pendingPayment ?? asPayment(tenant.paymentStatus)}
              onChange={(e) => {
                const paymentStatus = e.target
                  .value as SuperAdminPaymentStatus;
                if (paymentStatus === asPayment(tenant.paymentStatus)) return;
                onPaymentChange(paymentStatus);
              }}
            >
              <option value="ACTIVE">Al corriente</option>
              <option value="PENDING_PAYMENT">Pago pendiente</option>
            </select>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-zinc-400">
              Renueva el
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="datetime-local"
                aria-label={`Fecha de renovación de ${tenant.name}`}
                className={`${saField} w-full`}
                disabled={busy}
                defaultValue={isoToLocalInput(tenant.currentPeriodEnd)}
                key={tenant.currentPeriodEnd ?? "none"}
                id={`sa-period-${tenant.id}`}
              />
              <button
                type="button"
                disabled={busy}
                className={`${saPrimaryBtn} ${saFocus} shrink-0`}
                onClick={() => {
                  const el = document.getElementById(
                    `sa-period-${tenant.id}`,
                  ) as HTMLInputElement | null;
                  const raw = el?.value?.trim() ?? "";
                  const prev = isoToLocalInput(tenant.currentPeriodEnd);
                  if (raw === prev) return;
                  if (raw === "") {
                    onPeriodChange("");
                    return;
                  }
                  const iso = localInputToIso(raw);
                  if (!iso) return;
                  onPeriodChange(iso);
                }}
              >
                Guardar fecha
              </button>
            </div>
            <span className="text-[11px] text-zinc-500">
              Vacío + guardar limpia la renovación. Independiente de la
              expiración del cupón.
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {tenant.active ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSuspend}
              className={`${saDangerBtn} ${saFocus}`}
            >
              Suspender
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onActivate}
              className={`${saSoftSuccessBtn} ${saFocus}`}
            >
              Reactivar
            </button>
          )}
          <button
            type="button"
            disabled={busy || !tenant.active}
            data-testid={`sa-tenant-impersonate-${tenant.subdomain}`}
            onClick={onImpersonate}
            className={`${saSecondaryBtn} ${saFocus}`}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Abrir panel
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        Los cambios de plan, cobro y estado piden confirmación. Abrir panel usa
        otra pestaña; SuperAdmin no se cierra.
      </p>
    </div>
  );
}

export function SuperAdminTenantsTable({
  initialTenants,
}: {
  initialTenants: SuperAdminTenant[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatusFilter(searchParams.get("status")),
  );
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    parseSortKey(searchParams.get("sort")),
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    parseSortDir(searchParams.get("dir")),
  );
  const [managingId, setManagingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setTenants(initialTenants);
  }, [initialTenants]);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setStatusFilter(parseStatusFilter(searchParams.get("status")));
    setSortKey(parseSortKey(searchParams.get("sort")));
    setSortDir(parseSortDir(searchParams.get("dir")));
  }, [searchParams]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4500);
    return () => window.clearTimeout(t);
  }, [success]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function applyStatusFilter(next: StatusFilter) {
    setStatusFilter(next);
    replaceParams((params) => {
      if (next === "all") params.delete("status");
      else params.set("status", next);
    });
  }

  function applySort(nextKey: SortKey) {
    const nextDir: SortDir =
      sortKey === nextKey && sortDir === "asc" ? "desc" : "asc";
    setSortKey(nextKey);
    setSortDir(nextDir);
    replaceParams((params) => {
      if (nextKey === "name" && nextDir === "asc") {
        params.delete("sort");
        params.delete("dir");
      } else {
        params.set("sort", nextKey);
        params.set("dir", nextDir);
      }
    });
  }

  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    if (query.trim() === urlQ) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = query.trim();
      if (!trimmed) params.delete("q");
      else params.set("q", trimmed);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, searchParams, pathname, router]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setSortKey("name");
    setSortDir("asc");
    replaceParams((params) => {
      params.delete("status");
      params.delete("q");
      params.delete("sort");
      params.delete("dir");
    });
  }

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
    const rows = tenants.filter((t) => {
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
    return [...rows].sort((a, b) => compareTenants(a, b, sortKey, sortDir));
  }, [tenants, query, statusFilter, sortKey, sortDir]);

  function flashSuccess(message: string) {
    setSuccess(message);
    setError(null);
  }

  function isRowBusy(tenantId: number): boolean {
    return busyId === tenantId;
  }

  function toggleManage(tenantId: number) {
    setManagingId((prev) => (prev === tenantId ? null : tenantId));
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
    next: {
      plan?: SuperAdminPlan;
      paymentStatus?: SuperAdminPaymentStatus;
      currentPeriodEnd?: string | null;
      /** true si el payload incluye currentPeriodEnd (incluso vacío). */
      periodTouched?: boolean;
    },
  ) {
    if (isRowBusy(tenant.id)) return;
    const plan = next.plan ?? asPlan(tenant.plan);
    const paymentStatus = next.paymentStatus ?? asPayment(tenant.paymentStatus);
    const periodTouched = Boolean(next.periodTouched);
    if (
      plan === asPlan(tenant.plan) &&
      paymentStatus === asPayment(tenant.paymentStatus) &&
      !periodTouched
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
        ...(periodTouched
          ? { currentPeriodEnd: next.currentPeriodEnd ?? "" }
          : {}),
      });
      setTenants((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      setPending(null);
      if (periodTouched) {
        flashSuccess(
          `Renovación de ${updated.name} → ${formatPeriodEnd(updated.currentPeriodEnd)}.`,
        );
      } else if (next.plan != null) {
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
      if (!result.code?.trim()) {
        setDialogError("El servidor no devolvió un código de impersonación.");
        return;
      }
      const url = buildTenantAdminUrl(
        result.tenantSlug,
        `/admin/impersonate?code=${encodeURIComponent(result.code.trim())}`,
      );
      const supportTab = window.open(url, "_blank", "noopener,noreferrer");
      if (!supportTab) {
        setDialogError(
          "El navegador bloqueó la pestaña nueva. Permite ventanas emergentes para este sitio e inténtalo de nuevo.",
        );
        return;
      }
      setPending(null);
      flashSuccess(
        `Panel de ${tenant.name} abierto en otra pestaña. SuperAdmin sigue aquí.`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo abrir el panel del restaurante. Puede estar suspendido o falló el token de soporte.";
      setDialogError(message);
    } finally {
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
      case "period":
        void applySubscription(pending.tenant, {
          currentPeriodEnd: pending.currentPeriodEnd,
          periodTouched: true,
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
    detail?: ReactNode;
  } | null => {
    if (!pending) return null;
    const name = pending.tenant.name;
    const slug = pending.tenant.subdomain;
    switch (pending.kind) {
      case "suspend":
        return {
          title: `¿Suspender ${name}?`,
          description: `El restaurante ${name} dejará de operar en su subdominio hasta que lo reactives. Los comensales y el panel del local quedarán bloqueados.`,
          confirmLabel: "Suspender restaurante",
          busyLabel: "Suspendiendo…",
          tone: "danger",
          challenge: slug,
          detail: (
            <MutationReviewDetail
              rows={[
                { label: "Estado", from: "Activo", to: "Suspendido" },
              ]}
              note={`Subdominio: ${slug}`}
            />
          ),
        };
      case "activate":
        return {
          title: `¿Reactivar ${name}?`,
          description: `Se restablecerá el acceso al subdominio y al panel del restaurante.`,
          confirmLabel: "Reactivar restaurante",
          busyLabel: "Reactivando…",
          tone: "neutral",
          detail: (
            <MutationReviewDetail
              rows={[
                { label: "Estado", from: "Suspendido", to: "Activo" },
              ]}
              note={`Subdominio: ${slug}`}
            />
          ),
        };
      case "plan":
        return {
          title: `¿Cambiar plan de ${name}?`,
          description:
            "Esto afecta límites de menú y el acceso al sitio institucional Pro.",
          confirmLabel: `Cambiar a ${planLabel(pending.plan)}`,
          busyLabel: "Guardando…",
          tone: "neutral",
          detail: (
            <MutationReviewDetail
              rows={[
                {
                  label: "Plan",
                  from: planLabel(asPlan(pending.tenant.plan)),
                  to: planLabel(pending.plan),
                },
              ]}
              note={name}
            />
          ),
        };
      case "payment":
        return {
          title: `¿Actualizar cobro de ${name}?`,
          description:
            "El estado de cobro cambia de inmediato. La suspensión es una acción aparte.",
          confirmLabel: "Guardar cobro",
          busyLabel: "Guardando…",
          tone: "neutral",
          detail: (
            <MutationReviewDetail
              rows={[
                {
                  label: "Cobro",
                  from: paymentLabel(asPayment(pending.tenant.paymentStatus)),
                  to: paymentLabel(pending.paymentStatus),
                },
              ]}
              note={name}
            />
          ),
        };
      case "period":
        return {
          title: `¿Actualizar renovación de ${name}?`,
          description:
            "La fecha de renovación vive en el restaurante, no en el cupón.",
          confirmLabel: "Guardar renovación",
          busyLabel: "Guardando…",
          tone: "neutral",
          detail: (
            <MutationReviewDetail
              rows={[
                {
                  label: "Renueva",
                  from: formatPeriodEnd(pending.tenant.currentPeriodEnd),
                  to: pending.currentPeriodEnd
                    ? formatPeriodEnd(pending.currentPeriodEnd)
                    : "Sin fecha de renovación",
                },
              ]}
              note={name}
            />
          ),
        };
      case "impersonate": {
        const destination = buildTenantAdminUrl(slug, "/admin/dashboard");
        return {
          title: `¿Abrir el panel de ${name}?`,
          description: `Se abrirá el panel de ${name} en una pestaña nueva con un token de soporte. SuperAdmin permanece en esta pestaña. Escribe el subdominio para confirmar.`,
          confirmLabel: "Abrir en pestaña nueva",
          busyLabel: "Abriendo…",
          tone: "danger",
          challenge: slug,
          detail: (
            <MutationReviewDetail
              rows={[]}
              note={`Destino: ${destination}`}
            />
          ),
        };
      }
    }
  })();

  function manageHandlers(tenant: SuperAdminTenant) {
    return {
      onPlanChange: (plan: SuperAdminPlan) => {
        setDialogError(null);
        setPending({ kind: "plan", tenant, plan });
      },
      onPaymentChange: (paymentStatus: SuperAdminPaymentStatus) => {
        setDialogError(null);
        setPending({ kind: "payment", tenant, paymentStatus });
      },
      onPeriodChange: (currentPeriodEnd: string) => {
        setDialogError(null);
        setPending({ kind: "period", tenant, currentPeriodEnd });
      },
      onSuspend: () => {
        setDialogError(null);
        setPending({ kind: "suspend", tenant });
      },
      onActivate: () => {
        setDialogError(null);
        setPending({ kind: "activate", tenant });
      },
      onImpersonate: () => {
        setDialogError(null);
        setPending({ kind: "impersonate", tenant });
      },
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, subdominio o plan…"
            aria-label="Buscar restaurantes por nombre, subdominio o plan"
            className={`w-full rounded-xl border border-white/[0.08] bg-[#111113] py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-400 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 ${saFocus}`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 ${saFocus}`}
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
                onClick={() => applyStatusFilter(chip.id)}
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

      <label className="flex flex-col gap-1.5 md:hidden">
        <span className="text-xs font-medium text-zinc-400">Ordenar por</span>
        <select
          className={`${saSelect} w-full`}
          aria-label="Ordenar restaurantes"
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [keyRaw, dirRaw] = e.target.value.split(":");
            const nextKey = parseSortKey(keyRaw ?? null);
            const nextDir = parseSortDir(dirRaw ?? null);
            setSortKey(nextKey);
            setSortDir(nextDir);
            replaceParams((params) => {
              if (nextKey === "name" && nextDir === "asc") {
                params.delete("sort");
                params.delete("dir");
              } else {
                params.set("sort", nextKey);
                params.set("dir", nextDir);
              }
            });
          }}
        >
          <option value="name:asc">Nombre (A–Z)</option>
          <option value="name:desc">Nombre (Z–A)</option>
          <option value="plan:asc">Plan</option>
          <option value="payment:desc">Cobro (pendiente primero)</option>
          <option value="status:desc">Estado (suspendidos primero)</option>
        </select>
      </label>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111113] px-4 py-10 text-center text-sm text-zinc-400">
          {query.trim() || statusFilter !== "all" ? (
            <span className="inline-flex flex-col items-center gap-3">
              <span>
                Ningún restaurante coincide con los filtros actuales.
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className={`${saSecondaryBtn} ${saFocus}`}
              >
                Quitar filtros
              </button>
            </span>
          ) : (
            "Todavía no hay restaurantes registrados. El alta ocurre fuera de SuperAdmin; cuando existan, aparecerán aquí para plan, cobro y soporte."
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {filtered.map((tenant) => {
              const busy = isRowBusy(tenant.id);
              const open = managingId === tenant.id;
              const pendingPlan =
                pending?.kind === "plan" && pending.tenant.id === tenant.id
                  ? pending.plan
                  : null;
              const pendingPayment =
                pending?.kind === "payment" &&
                pending.tenant.id === tenant.id
                  ? pending.paymentStatus
                  : null;
              const panelId = `tenant-manage-mobile-${tenant.id}`;

              return (
                <li
                  key={tenant.id}
                  className={`rounded-2xl border border-white/[0.06] bg-[#111113] p-4 ${
                    open ? "ring-1 ring-emerald-500/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <TenantSummaryFacts tenant={tenant} variant="card" />
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      disabled={busy}
                      onClick={() => toggleManage(tenant.id)}
                      className={`${saSecondaryBtn} ${saFocus} shrink-0 ${
                        open
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : ""
                      }`}
                    >
                      {open ? "Cerrar" : "Gestionar"}
                      <ChevronDown
                        className={`size-3.5 transition ${
                          open ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      />
                    </button>
                  </div>
                  {open ? (
                    <div id={panelId} className="mt-4">
                      <TenantManageFields
                        tenant={tenant}
                        busy={busy}
                        pendingPlan={pendingPlan}
                        pendingPayment={pendingPayment}
                        {...manageHandlers(tenant)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs font-medium tracking-wide text-zinc-400">
                  <tr>
                    {(
                      [
                        { key: "name" as const, label: "Restaurante" },
                        { key: "plan" as const, label: "Plan" },
                        { key: "payment" as const, label: "Cobro" },
                        { key: "status" as const, label: "Estado" },
                      ] as const
                    ).map((col) => {
                      const active = sortKey === col.key;
                      const ariaSort = active
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none";
                      return (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={ariaSort}
                          className="px-4 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => applySort(col.key)}
                            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs font-medium transition hover:text-zinc-200 ${saFocus} ${
                              active ? "text-zinc-200" : "text-zinc-400"
                            }`}
                          >
                            {col.label}
                            {active ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="size-3.5" aria-hidden />
                              ) : (
                                <ArrowDown className="size-3.5" aria-hidden />
                              )
                            ) : (
                              <ArrowUpDown
                                className="size-3.5 opacity-50"
                                aria-hidden
                              />
                            )}
                            <span className="sr-only">
                              {active
                                ? sortDir === "asc"
                                  ? "ordenado ascendente, activar para descendente"
                                  : "ordenado descendente, activar para ascendente"
                                : "ordenar"}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right">
                      <span className="sr-only">Gestionar</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map((tenant) => {
                    const busy = isRowBusy(tenant.id);
                    const open = managingId === tenant.id;
                    const pendingPlan =
                      pending?.kind === "plan" &&
                      pending.tenant.id === tenant.id
                        ? pending.plan
                        : null;
                    const pendingPayment =
                      pending?.kind === "payment" &&
                      pending.tenant.id === tenant.id
                        ? pending.paymentStatus
                        : null;
                    const panelId = `tenant-manage-${tenant.id}`;

                    return (
                      <Fragment key={tenant.id}>
                        <tr
                          className={
                            open ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                          }
                        >
                          <td className="max-w-[16rem] min-w-0 px-4 py-3.5">
                            <TenantSummaryFacts
                              tenant={tenant}
                              variant="table"
                            />
                          </td>
                          <td className="px-4 py-3.5 text-xs font-medium text-zinc-300">
                            {planLabel(asPlan(tenant.plan))}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-medium text-zinc-300">
                            {paymentLabel(asPayment(tenant.paymentStatus))}
                          </td>
                          <td className="px-4 py-3.5">
                            <TenantStatusBadge active={tenant.active} />
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-controls={panelId}
                              disabled={busy}
                              onClick={() => toggleManage(tenant.id)}
                              className={`${saSecondaryBtn} ${saFocus} ${
                                open
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                  : ""
                              }`}
                            >
                              {open ? "Cerrar" : "Gestionar"}
                              <ChevronDown
                                className={`size-3.5 transition ${
                                  open ? "rotate-180" : ""
                                }`}
                                aria-hidden
                              />
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={5} className="px-4 py-4" id={panelId}>
                              <TenantManageFields
                                tenant={tenant}
                                busy={busy}
                                pendingPlan={pendingPlan}
                                pendingPayment={pendingPayment}
                                {...manageHandlers(tenant)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <p className="text-xs text-zinc-400">
        {filtered.length} de {tenants.length} restaurantes
        {statusFilter !== "all" || query.trim() || sortKey !== "name" || sortDir !== "asc"
          ? " · enlace de esta vista listo para guardar o compartir"
          : null}
      </p>

      {dialogCopy && pending ? (
        <SuperAdminConfirmDialog
          open
          title={dialogCopy.title}
          description={dialogCopy.description}
          detail={dialogCopy.detail ?? null}
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
