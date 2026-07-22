"use client";

/**
 * Formulario de onboarding SaaS B2B: crea restaurante + owner.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getRegisterErrorMessage,
  registerRestaurant,
} from "@/services/tenantService";
import type { RegisterTenantDTO } from "@/types/auth";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "static",
  "assets",
]);

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() || "tusass.com";

interface FieldErrors {
  restaurantName?: string;
  tenantSlug?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

interface RegisterFormProps {
  /** `b2b` = estilos del landing charcoal/emerald (sin card exterior). */
  variant?: "default" | "b2b";
  /** Plan preseleccionado desde la sección de precios. */
  defaultPlan?: "BASIC" | "PRO";
}

function sanitizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

function validate(form: RegisterTenantDTO): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.restaurantName.trim()) {
    errors.restaurantName = "Ingresa el nombre de tu restaurante.";
  }

  const slug = form.tenantSlug.trim().toLowerCase();
  if (!slug) {
    errors.tenantSlug = "Elige un subdominio para tu sitio.";
  } else if (slug.includes(" ")) {
    errors.tenantSlug = "El subdominio no puede contener espacios.";
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.tenantSlug =
      "Solo minúsculas, números y guiones (sin caracteres especiales).";
  } else if (RESERVED_SLUGS.has(slug)) {
    errors.tenantSlug = "Ese subdominio está reservado. Elige otro.";
  }

  if (!form.ownerName.trim()) {
    errors.ownerName = "Ingresa tu nombre.";
  }

  if (!form.ownerEmail.trim()) {
    errors.ownerEmail = "Ingresa tu correo.";
  } else if (!EMAIL_PATTERN.test(form.ownerEmail.trim())) {
    errors.ownerEmail = "El correo no tiene un formato válido.";
  }

  if (!form.ownerPassword) {
    errors.ownerPassword = "Crea una contraseña.";
  } else if (form.ownerPassword.length < 8) {
    errors.ownerPassword = "Mínimo 8 caracteres.";
  }

  return errors;
}

function buildAdminLoginUrl(tenantSlug: string): string {
  if (typeof window === "undefined") {
    return `http://${tenantSlug}.localhost:3000/admin/login`;
  }

  const { protocol, hostname, port } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1";

  if (isLocal) {
    const portSuffix = port ? `:${port}` : "";
    return `${protocol}//${tenantSlug}.localhost${portSuffix}/admin/login`;
  }

  return `${protocol}//${tenantSlug}.${ROOT_DOMAIN}/admin/login`;
}

const EMPTY_FORM: RegisterTenantDTO = {
  restaurantName: "",
  tenantSlug: "",
  ownerEmail: "",
  ownerName: "",
  ownerPassword: "",
  plan: "BASIC",
  couponCode: "",
};

export function RegisterForm({
  variant = "default",
  defaultPlan = "BASIC",
}: RegisterFormProps) {
  const isB2b = variant === "b2b";
  const [form, setForm] = useState<RegisterTenantDTO>({
    ...EMPTY_FORM,
    plan: defaultPlan,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdPlan, setCreatedPlan] = useState<"BASIC" | "PRO">("BASIC");
  const [createdPaymentStatus, setCreatedPaymentStatus] = useState<string>(
    "ACTIVE",
  );
  /** Sufijo de host estable en SSR; se ajusta en cliente tras montar (evita hydration mismatch). */
  const [hostSuffix, setHostSuffix] = useState(`.${ROOT_DOMAIN}`);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      plan: defaultPlan,
      couponCode: defaultPlan === "PRO" ? prev.couponCode : "",
    }));
  }, [defaultPlan]);

  useEffect(() => {
    const { hostname, port } = window.location;
    const isLocal =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1";
    if (isLocal) {
      setHostSuffix(`.localhost${port ? `:${port}` : ""}`);
    }
  }, []);

  const previewHost = useMemo(() => {
    const slug = form.tenantSlug.trim().toLowerCase() || "tu-restaurante";
    return `${slug}${hostSuffix}`;
  }, [form.tenantSlug, hostSuffix]);

  function updateField<K extends keyof RegisterTenantDTO>(
    key: K,
    value: RegisterTenantDTO[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await registerRestaurant(form);
      setCreatedSlug(result.tenantSlug);
      setCreatedPlan(result.plan === "PRO" ? "PRO" : "BASIC");
      setCreatedPaymentStatus(result.paymentStatus ?? "ACTIVE");
      setForm({ ...EMPTY_FORM, plan: defaultPlan });
      setFieldErrors({});
    } catch (error) {
      setFormError(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const labelClass = isB2b
    ? "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
    : "text-sm font-medium";

  const inputClass = isB2b
    ? "w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
    : "rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-neutral-900/20 focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5";

  const errorClass = isB2b
    ? "mt-1 text-xs text-red-400"
    : "text-xs text-red-600 dark:text-red-400";

  if (createdSlug) {
    const panelUrl = buildAdminLoginUrl(createdSlug);
    return (
      <section
        aria-live="polite"
        className={
          isB2b
            ? "w-full py-4 text-center"
            : "w-full rounded-3xl border border-emerald-500/25 bg-white p-6 text-left shadow-sm dark:border-emerald-400/20 dark:bg-neutral-900 sm:p-8"
        }
      >
        <p
          className={
            isB2b
              ? "text-xs font-semibold uppercase tracking-wider text-emerald-400"
              : "text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
          }
        >
          Listo
        </p>
        <h2
          className={
            isB2b
              ? "mt-3 text-3xl font-black text-white"
              : "mt-2 text-2xl font-extrabold tracking-tight"
          }
        >
          ¡Tu restaurante ha sido creado con éxito!
        </h2>
        <p
          className={
            isB2b
              ? "mt-3 text-sm leading-relaxed text-slate-400"
              : "mt-2 text-sm leading-relaxed text-black/60 dark:text-white/60"
          }
        >
          Ya puedes entrar al panel de{" "}
          <span
            className={
              isB2b
                ? "font-semibold text-emerald-400"
                : "font-semibold text-foreground"
            }
          >
            {createdSlug}
          </span>{" "}
          con el correo y la contraseña que acabas de registrar.
          {createdPlan === "PRO" && createdPaymentStatus === "PENDING_PAYMENT"
            ? " Tu Plan Pro quedó con pago pendiente: coordina el cobro y canjea el cupón en Configuración para publicar el sitio."
            : null}
          {createdPlan === "PRO" && createdPaymentStatus === "ACTIVE"
            ? " Tu Plan Pro ya está activo (cupón aplicado)."
            : null}
        </p>
        <a
          href={panelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isB2b
              ? "btn-emerald mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold text-white"
              : "mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-transform active:scale-[0.98] sm:w-auto"
          }
        >
          Ir a mi Panel de Control
        </a>
        <button
          type="button"
          onClick={() => setCreatedSlug(null)}
          className={
            isB2b
              ? "mt-4 block w-full text-center text-sm font-medium text-slate-500 transition hover:text-emerald-400"
              : "mt-3 block w-full text-center text-sm font-medium text-black/50 transition hover:text-foreground dark:text-white/50 sm:mt-4 sm:w-auto sm:text-left"
          }
        >
          Registrar otro restaurante
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={
        isB2b
          ? "w-full space-y-4"
          : "w-full rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-900 sm:p-8"
      }
    >
      {!isB2b ? (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
            Onboarding
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
            Crea tu restaurante
          </h2>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            En minutos tendrás menú digital, panel de cocina y tu propio
            subdominio.
          </p>
        </div>
      ) : null}

      <fieldset className={isB2b ? "block" : "sm:col-span-2"}>
        <legend className={labelClass}>Plan</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(
            [
              {
                id: "BASIC" as const,
                title: "Básico",
                hint: "Menú QR · hasta 30 platillos",
              },
              {
                id: "PRO" as const,
                title: "Pro",
                hint: "Sitio web + menú ilimitado",
              },
            ] as const
          ).map((option) => {
            const selected = form.plan === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={isSubmitting}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    plan: option.id,
                    couponCode: option.id === "PRO" ? prev.couponCode : "",
                  }))
                }
                className={
                  isB2b
                    ? `rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-emerald-400/60 bg-emerald-500/15 ring-2 ring-emerald-500/25"
                          : "border-slate-700/80 bg-slate-950/60 hover:border-slate-500"
                      }`
                    : `rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20 dark:bg-emerald-950/40"
                          : "border-black/10 dark:border-white/10"
                      }`
                }
              >
                <span
                  className={
                    isB2b
                      ? "block text-sm font-bold text-white"
                      : "block text-sm font-bold"
                  }
                >
                  {option.title}
                </span>
                <span
                  className={
                    isB2b
                      ? "mt-0.5 block text-[11px] leading-snug text-slate-400"
                      : "mt-0.5 block text-[11px] leading-snug text-black/50 dark:text-white/50"
                  }
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {form.plan === "PRO" ? (
        <label className={isB2b ? "block" : "flex flex-col gap-1.5 sm:col-span-2"}>
          <span className={labelClass}>Cupón (opcional)</span>
          <input
            type="text"
            name="couponCode"
            autoComplete="off"
            spellCheck={false}
            disabled={isSubmitting}
            value={form.couponCode ?? ""}
            onChange={(e) =>
              updateField("couponCode", e.target.value.toUpperCase())
            }
            className={inputClass}
            placeholder="Ej. SETUP-CASH-1000"
            maxLength={40}
          />
          <span
            className={
              isB2b
                ? "mt-1 block text-[11px] text-slate-500"
                : "text-[11px] text-black/45 dark:text-white/45"
            }
          >
            Si ya pagaste en efectivo o transferencia, pega aquí el código. Si
            no, puedes canjearlo después en Configuración.
          </span>
        </label>
      ) : null}

      <div className={isB2b ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <label className={isB2b ? "block" : "flex flex-col gap-1.5 sm:col-span-2"}>
          <span className={labelClass}>Nombre del restaurante</span>
          <input
            type="text"
            name="restaurantName"
            autoComplete="organization"
            disabled={isSubmitting}
            value={form.restaurantName}
            onChange={(e) => updateField("restaurantName", e.target.value)}
            className={inputClass}
            placeholder="La Taquería del Sol"
          />
          {fieldErrors.restaurantName ? (
            <span className={errorClass}>{fieldErrors.restaurantName}</span>
          ) : null}
        </label>

        <label className={isB2b ? "block" : "flex flex-col gap-1.5 sm:col-span-2"}>
          <span className={labelClass}>Subdominio deseado</span>
          <div
            className={
              isB2b
                ? "flex items-center overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/80 focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20"
                : "flex items-center gap-0 overflow-hidden rounded-xl border border-black/10 focus-within:ring-2 focus-within:ring-neutral-900/20 dark:border-white/10"
            }
          >
            <input
              type="text"
              name="tenantSlug"
              autoComplete="off"
              spellCheck={false}
              disabled={isSubmitting}
              value={form.tenantSlug}
              onChange={(e) =>
                updateField("tenantSlug", sanitizeSlugInput(e.target.value))
              }
              className={
                isB2b
                  ? "min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
                  : "min-w-0 flex-1 bg-black/2 px-3.5 py-2.5 text-sm outline-none disabled:opacity-60 dark:bg-white/5"
              }
              placeholder="mi-restaurante"
              aria-describedby="slug-preview"
            />
            <span
              className={
                isB2b
                  ? "shrink-0 border-l border-slate-700/60 bg-emerald-500/5 px-3 py-3 text-xs font-semibold whitespace-nowrap text-emerald-400"
                  : "shrink-0 bg-black/5 px-3 py-2.5 text-sm text-black/50 dark:bg-white/10 dark:text-white/50"
              }
            >
              .{ROOT_DOMAIN}
            </span>
          </div>
          <p
            id="slug-preview"
            className={
              isB2b
                ? "mt-1 text-[11px] text-emerald-400"
                : "text-xs text-black/50 dark:text-white/50"
            }
          >
            Tu sitio será:{" "}
            <span className={isB2b ? "font-semibold" : "font-semibold text-foreground"}>
              {previewHost}
            </span>
          </p>
          {fieldErrors.tenantSlug ? (
            <span className={errorClass}>{fieldErrors.tenantSlug}</span>
          ) : null}
        </label>

        <div className={isB2b ? "grid gap-4 sm:grid-cols-2" : "contents"}>
          <label className={isB2b ? "block" : "flex flex-col gap-1.5"}>
            <span className={labelClass}>Nombre del dueño</span>
            <input
              type="text"
              name="ownerName"
              autoComplete="name"
              disabled={isSubmitting}
              value={form.ownerName}
              onChange={(e) => updateField("ownerName", e.target.value)}
              className={inputClass}
              placeholder="Carlos Mendoza"
            />
            {fieldErrors.ownerName ? (
              <span className={errorClass}>{fieldErrors.ownerName}</span>
            ) : null}
          </label>

          <label className={isB2b ? "block" : "flex flex-col gap-1.5"}>
            <span className={labelClass}>Correo electrónico</span>
            <input
              type="email"
              name="ownerEmail"
              autoComplete="email"
              disabled={isSubmitting}
              value={form.ownerEmail}
              onChange={(e) => updateField("ownerEmail", e.target.value)}
              className={inputClass}
              placeholder="carlos@taqueria.com"
            />
            {fieldErrors.ownerEmail ? (
              <span className={errorClass}>{fieldErrors.ownerEmail}</span>
            ) : null}
          </label>
        </div>

        <label className={isB2b ? "block" : "flex flex-col gap-1.5 sm:col-span-2"}>
          <span className={labelClass}>Contraseña</span>
          <input
            type="password"
            name="ownerPassword"
            autoComplete="new-password"
            disabled={isSubmitting}
            value={form.ownerPassword}
            onChange={(e) => updateField("ownerPassword", e.target.value)}
            className={inputClass}
            placeholder="Mínimo 8 caracteres"
          />
          {fieldErrors.ownerPassword ? (
            <span className={errorClass}>{fieldErrors.ownerPassword}</span>
          ) : null}
        </label>
      </div>

      {formError ? (
        <p
          role="alert"
          className={
            isB2b
              ? "rounded-xl bg-red-500/10 px-3.5 py-3 text-sm leading-snug text-red-300"
              : "mt-4 rounded-xl bg-red-500/10 px-3.5 py-3 text-sm leading-snug text-red-700 dark:text-red-300"
          }
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={
          isB2b
            ? "btn-emerald mt-2 flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl py-4 text-base font-bold text-white disabled:cursor-wait disabled:opacity-80"
            : "mt-6 w-full rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-neutral-900"
        }
      >
        {isSubmitting
          ? "Configurando tu restaurante..."
          : isB2b
            ? "Lanzar mi Restaurante"
            : "Crear mi restaurante"}
      </button>

      {isB2b ? (
        <p className="text-center text-[11px] text-slate-600">
          Al registrarte aceptas nuestros términos de servicio y política de
          privacidad.
        </p>
      ) : null}
    </form>
  );
}
