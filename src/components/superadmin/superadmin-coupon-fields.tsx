/**
 * Piezas compartidas de fila de cupón (móvil + desktop).
 */

import type { SuperAdminCoupon, SuperAdminPlan } from "@/types/superadmin";
import {
  saDangerBtn,
  saField,
  saFocus,
  saPrimaryBtn,
  saSecondaryBtn,
  saSelect,
  saSoftSuccessBtn,
} from "@/components/superadmin/superadmin-ui";

export function formatCouponUsages(coupon: SuperAdminCoupon): string {
  if (coupon.maxRedemptions == null) {
    return `${coupon.redemptionCount} / ilimitado`;
  }
  return `${coupon.redemptionCount} / ${coupon.maxRedemptions}`;
}

export function formatCouponExpires(expiresAt: string | null): string {
  if (!expiresAt) return "Sin expiración";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return expiresAt;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function planGrantLabel(plan: SuperAdminPlan | string): string {
  return plan === "PRO" ? "Pro" : "Básico";
}

export function usagesDraftLabel(maxRaw: string): string {
  const trimmed = maxRaw.trim();
  if (trimmed === "") return "Ilimitado";
  return trimmed;
}

export function formatGrantDuration(days: number | null | undefined): string {
  if (days == null) return "Sin período";
  return days === 1 ? "1 día de plan" : `${days} días de plan`;
}

export function grantDurationDraftLabel(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "Sin período";
  return formatGrantDuration(Number.parseInt(trimmed, 10));
}

export function CouponSummaryFacts({
  coupon,
  showMeta = true,
}: {
  coupon: SuperAdminCoupon;
  /** false en tabla desktop (plan/usos/estado van en columnas). */
  showMeta?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-sm font-medium text-white">{coupon.code}</p>
      {coupon.description ? (
        <p className="mt-1 text-xs text-zinc-400">{coupon.description}</p>
      ) : null}
      {showMeta ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
          <span>{planGrantLabel(coupon.grantsPlan)}</span>
          <span className="font-mono text-zinc-400">
            {formatCouponUsages(coupon)}
          </span>
          <span className="text-zinc-400">
            {formatCouponExpires(coupon.expiresAt)}
          </span>
          <span className="text-zinc-400">
            {formatGrantDuration(coupon.grantDurationDays)}
          </span>
          <span
            className={coupon.active ? "text-emerald-300" : "text-zinc-400"}
          >
            {coupon.active ? "Activo" : "Inactivo"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function CouponEditFields({
  description,
  plan,
  max,
  expires,
  grantDays,
  busy,
  onDescription,
  onPlan,
  onMax,
  onExpires,
  onGrantDays,
  onSave,
  onCancel,
}: {
  description: string;
  plan: SuperAdminPlan;
  max: string;
  expires: string;
  grantDays: string;
  busy: boolean;
  onDescription: (v: string) => void;
  onPlan: (v: SuperAdminPlan) => void;
  onMax: (v: string) => void;
  onExpires: (v: string) => void;
  onGrantDays: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="text-xs font-medium text-zinc-400">Descripción</span>
        <input
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          className={saField}
          placeholder="Descripción"
          disabled={busy}
          maxLength={255}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">Plan que otorga</span>
        <select
          className={`${saSelect} w-full`}
          value={plan}
          onChange={(e) => onPlan(e.target.value as SuperAdminPlan)}
          disabled={busy}
          aria-label="Plan que otorga"
        >
          <option value="PRO">Pro</option>
          <option value="BASIC">Básico</option>
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">
          Máx. usos (vacío = ilimitado)
        </span>
        <input
          type="number"
          min={1}
          value={max}
          onChange={(e) => onMax(e.target.value)}
          className={saField}
          disabled={busy}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">Expira (canje)</span>
        <input
          type="datetime-local"
          value={expires}
          onChange={(e) => onExpires(e.target.value)}
          className={saField}
          disabled={busy}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">
          Días de plan (vacío = sin fecha de renovación)
        </span>
        <input
          type="number"
          min={1}
          max={3650}
          value={grantDays}
          onChange={(e) => onGrantDays(e.target.value)}
          className={saField}
          disabled={busy}
          placeholder="30"
          aria-label="Días de plan al canjear"
        />
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className={`${saPrimaryBtn} px-3 text-xs ${saFocus}`}
        >
          Revisar y guardar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={`${saSecondaryBtn} ${saFocus}`}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function CouponRowActions({
  coupon,
  disabled,
  onEdit,
  onToggle,
}: {
  coupon: SuperAdminCoupon;
  disabled: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        className={`${saSecondaryBtn} ${saFocus}`}
      >
        Editar
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`${coupon.active ? saDangerBtn : saSoftSuccessBtn} ${saFocus}`}
      >
        {coupon.active ? "Desactivar" : "Activar"}
      </button>
    </div>
  );
}

export function CouponActiveBadge({ active }: { active: boolean }) {
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
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}
