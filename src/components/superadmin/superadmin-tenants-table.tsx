"use client";

/**
 * Tabla global de tenants + suspender/activar + impersonación.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import type { SuperAdminTenant } from "@/types/superadmin";
import {
  impersonateTenant,
  updateTenantActiveStatus,
} from "@/services/superadminService";
import { ApiError } from "@/services/apiClient";

function planBadge(plan: string): { label: string; className: string } {
  switch (plan) {
    case "PRO":
      return {
        label: "Pro",
        className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      };
    case "ENTERPRISE":
      return {
        label: "Enterprise",
        className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
      };
    default:
      return {
        label: "Básico",
        className: "bg-zinc-500/20 text-zinc-300 ring-zinc-500/30",
      };
  }
}

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

export function SuperAdminTenantsTable({
  initialTenants,
}: {
  initialTenants: SuperAdminTenant[];
}) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subdomain.toLowerCase().includes(q) ||
        t.plan.toLowerCase().includes(q),
    );
  }, [tenants, query]);

  async function toggleActive(tenant: SuperAdminTenant) {
    if (busyId != null) return;
    setBusyId(tenant.id);
    setError(null);
    try {
      const updated = await updateTenantActiveStatus(tenant.id, !tenant.active);
      setTenants((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el estado.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleImpersonate(tenant: SuperAdminTenant) {
    if (busyId != null || !tenant.active) return;
    setBusyId(tenant.id);
    setError(null);
    try {
      const result = await impersonateTenant(tenant.id);
      // Cookie admin es host-only: handoff en el subdominio (token en hash).
      const base = buildTenantAdminUrl(result.tenantSlug, "/admin/impersonate");
      window.location.assign(
        `${base}#${encodeURIComponent(result.token)}`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar la impersonación.",
      );
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, slug o plan…"
          className="w-full rounded-xl border border-white/[0.08] bg-[#111113] py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurante</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    No hay tenants que coincidan.
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => {
                  const badge = planBadge(tenant.plan);
                  const busy = busyId === tenant.id;
                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-white">{tenant.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500">
                          {tenant.subdomain}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-400">
                        {tenant.paymentStatus === "PENDING_PAYMENT"
                          ? "Pago pendiente"
                          : "Activo"}
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
                          />
                          {tenant.active ? "Activo" : "Suspendido"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                            <span className="sr-only">
                              {tenant.active ? "Suspender" : "Activar"}
                            </span>
                            <input
                              type="checkbox"
                              role="switch"
                              checked={tenant.active}
                              disabled={busy}
                              onChange={() => void toggleActive(tenant)}
                              className="peer sr-only"
                            />
                            <span
                              className={`relative h-5 w-9 rounded-full transition ${
                                tenant.active
                                  ? "bg-emerald-500/80"
                                  : "bg-zinc-700"
                              } ${busy ? "opacity-50" : ""}`}
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
                            onClick={() => void handleImpersonate(tenant)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ExternalLink className="size-3.5" />
                            Ingresar como Admin
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
        {filtered.length} de {tenants.length} tenants
      </p>
    </div>
  );
}
