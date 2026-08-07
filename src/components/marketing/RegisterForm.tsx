"use client";

/**
 * Formulario de onboarding SaaS B2B: crea restaurante + owner.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  getRegisterErrorMessage,
  registerRestaurant,
} from "@/services/tenantService";
import type { RegisterTenantDTO } from "@/types/auth";
import { getPublicRootDomain } from "@/lib/qr-menu-url";

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

const ROOT_DOMAIN = getPublicRootDomain();

type RegisterStep = "plan" | "local" | "cuenta";

const B2B_STEPS: { id: RegisterStep; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "local", label: "Local" },
  { id: "cuenta", label: "Cuenta" },
];

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

function validateLocal(form: RegisterTenantDTO): FieldErrors {
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

  return errors;
}

function validateCuenta(form: RegisterTenantDTO): FieldErrors {
  const errors: FieldErrors = {};

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

function validate(form: RegisterTenantDTO): FieldErrors {
  return { ...validateLocal(form), ...validateCuenta(form) };
}

function focusFirstError(errors: FieldErrors) {
  const order: (keyof FieldErrors)[] = [
    "restaurantName",
    "tenantSlug",
    "ownerName",
    "ownerEmail",
    "ownerPassword",
  ];
  const firstInvalid = order.find((key) => errors[key]);
  if (firstInvalid) {
    document
      .querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
      ?.focus();
  }
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
  const [step, setStep] = useState<RegisterStep>("plan");
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
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const skipStepFocusRef = useRef(true);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      plan: defaultPlan,
      couponCode: defaultPlan === "PRO" ? prev.couponCode : "",
    }));
    if (isB2b) {
      setStep("plan");
      setFieldErrors({});
      setFormError(null);
    }
  }, [defaultPlan, isB2b]);

  useEffect(() => {
    if (!isB2b) return;
    if (skipStepFocusRef.current) {
      skipStepFocusRef.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step, isB2b]);

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

  const stepIndex = B2B_STEPS.findIndex((s) => s.id === step);

  function updateField<K extends keyof RegisterTenantDTO>(
    key: K,
    value: RegisterTenantDTO[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    setFormError(null);
    if (step === "plan") {
      setFieldErrors({});
      setStep("local");
      return;
    }
    if (step === "local") {
      const errors = validateLocal(form);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        focusFirstError(errors);
        return;
      }
      setStep("cuenta");
    }
  }

  function goBack() {
    setFormError(null);
    setFieldErrors({});
    if (step === "cuenta") setStep("local");
    else if (step === "local") setStep("plan");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (isB2b && step !== "cuenta") {
      goNext();
      return;
    }

    setFormError(null);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (isB2b) {
        const localErrors = validateLocal(form);
        if (Object.keys(localErrors).length > 0) {
          setStep("local");
          setFieldErrors(localErrors);
          focusFirstError(localErrors);
          return;
        }
      }
      focusFirstError(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerRestaurant(form);
      setCreatedSlug(result.tenantSlug);
      setCreatedPlan(result.plan === "PRO" ? "PRO" : "BASIC");
      setCreatedPaymentStatus(result.paymentStatus ?? "ACTIVE");
      setForm({ ...EMPTY_FORM, plan: defaultPlan });
      setFieldErrors({});
      setStep("plan");
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
    ? "w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus-visible:border-[var(--b2b-accent-deep)] focus-visible:ring-2 focus-visible:ring-[var(--b2b-focus)]/35 disabled:opacity-60"
    : "rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-neutral-900/20 focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5";

  const errorClass = isB2b
    ? "mt-1 text-xs text-red-400"
    : "text-xs text-red-600 dark:text-red-400";

  const planPicker = (
    <fieldset
      className={isB2b ? "block" : "sm:col-span-2"}
      role="radiogroup"
      aria-label="Plan"
    >
      <legend className={labelClass}>Plan</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {(
          [
            {
              id: "BASIC" as const,
              title: "Básico",
              hint: "Gratis · menú QR hasta 20 platillos",
            },
            {
              id: "PRO" as const,
              title: "Pro",
              hint: "Sitio a medida + menú ilimitado",
            },
          ] as const
        ).map((option) => {
          const selected = form.plan === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
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
                  ? `min-h-11 rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-[var(--b2b-accent)]/60 bg-[var(--b2b-accent-deep)]/15 ring-2 ring-[var(--b2b-focus)]/30"
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
                    ? "mt-0.5 block text-xs leading-snug text-slate-400"
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
  );

  const proCashCallout =
    form.plan === "PRO" ? (
      <div
        className={
          isB2b
            ? "rounded-xl border border-amber-400/25 bg-amber-500/5 px-4 py-3 text-sm leading-relaxed text-amber-100/90"
            : "rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        }
        role="note"
      >
        <p className={isB2b ? "font-semibold text-amber-200" : "font-semibold"}>
          Pro: $1,000 MXN/mes + $2,000 MXN de setup (pago único)
        </p>
        <p className={isB2b ? "mt-1 text-amber-100/75" : "mt-1 opacity-80"}>
          Menú QR y cocina operan desde hoy. El sitio a medida se publica cuando
          lo entregamos. Cobro por transferencia o efectivo; cupón al activar.
        </p>
      </div>
    ) : (
      <div
        className={
          isB2b
            ? "rounded-xl border border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm leading-relaxed text-slate-400"
            : "rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/60 dark:border-white/10 dark:text-white/60"
        }
        role="note"
      >
        Básico es gratis para empezar. Puedes pasar a Pro después, cuando quieras
        tu sitio a medida.
      </div>
    );

  const couponField =
    form.plan === "PRO" ? (
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
              ? "mt-1 block text-xs text-slate-400"
              : "text-[11px] text-black/45 dark:text-white/45"
          }
        >
          Si ya pagaste, pega el código. Si no, puedes canjearlo después en
          Configuración.
        </span>
      </label>
    ) : null;

  const localFields = (
    <>
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
          maxLength={120}
          aria-invalid={Boolean(fieldErrors.restaurantName)}
          aria-describedby={
            fieldErrors.restaurantName ? "err-restaurantName" : undefined
          }
        />
        {fieldErrors.restaurantName ? (
          <span id="err-restaurantName" role="alert" className={errorClass}>
            {fieldErrors.restaurantName}
          </span>
        ) : null}
      </label>

      <label className={isB2b ? "block" : "flex flex-col gap-1.5 sm:col-span-2"}>
        <span className={labelClass}>Subdominio deseado</span>
        <div
          className={
            isB2b
            ? "flex items-center overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/80 focus-within:border-[var(--b2b-accent-deep)] focus-within:ring-2 focus-within:ring-[var(--b2b-focus)]/35"
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
                ? "min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
                : "min-w-0 flex-1 bg-black/2 px-3.5 py-2.5 text-sm outline-none disabled:opacity-60 dark:bg-white/5"
            }
            placeholder="mi-restaurante"
            maxLength={48}
            aria-invalid={Boolean(fieldErrors.tenantSlug)}
            aria-describedby={
              fieldErrors.tenantSlug
                ? "slug-preview err-tenantSlug"
                : "slug-preview"
            }
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
              ? "mt-1 text-xs text-emerald-400"
              : "text-xs text-black/50 dark:text-white/50"
          }
        >
          Tu sitio será:{" "}
          <span
            className={isB2b ? "font-semibold" : "font-semibold text-foreground"}
          >
            {previewHost}
          </span>
        </p>
        {fieldErrors.tenantSlug ? (
          <span id="err-tenantSlug" role="alert" className={errorClass}>
            {fieldErrors.tenantSlug}
          </span>
        ) : null}
      </label>
    </>
  );

  const cuentaFields = (
    <>
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
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.ownerName)}
            aria-describedby={
              fieldErrors.ownerName ? "err-ownerName" : undefined
            }
          />
          {fieldErrors.ownerName ? (
            <span id="err-ownerName" role="alert" className={errorClass}>
              {fieldErrors.ownerName}
            </span>
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
            maxLength={254}
            aria-invalid={Boolean(fieldErrors.ownerEmail)}
            aria-describedby={
              fieldErrors.ownerEmail ? "err-ownerEmail" : undefined
            }
          />
          {fieldErrors.ownerEmail ? (
            <span id="err-ownerEmail" role="alert" className={errorClass}>
              {fieldErrors.ownerEmail}
            </span>
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
          maxLength={128}
          aria-invalid={Boolean(fieldErrors.ownerPassword)}
          aria-describedby={
            fieldErrors.ownerPassword ? "err-ownerPassword" : undefined
          }
        />
        {fieldErrors.ownerPassword ? (
          <span id="err-ownerPassword" role="alert" className={errorClass}>
            {fieldErrors.ownerPassword}
          </span>
        ) : null}
      </label>
    </>
  );

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
            ? " Tu Plan Pro quedó con pago pendiente: el menú sigue con el tope del Plan Básico (20 platillos) hasta que canjees el cupón o confirmemos el cobro en Configuración."
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
              ? "btn-emerald mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold text-white"
              : "mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-transform active:scale-[0.98] sm:w-auto"
          }
        >
          Ir a mi Panel de Control
        </a>
        <button
          type="button"
          onClick={() => {
            setCreatedSlug(null);
            setStep("plan");
          }}
          className={
            isB2b
              ? "mt-4 block min-h-11 w-full text-center text-sm font-medium text-slate-500 transition hover:text-emerald-400"
              : "mt-3 block w-full text-center text-sm font-medium text-black/50 transition hover:text-foreground dark:text-white/50 sm:mt-4 sm:w-auto sm:text-left"
          }
        >
          Crear otro restaurante
        </button>
      </section>
    );
  }

  if (!isB2b) {
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-900 sm:p-8"
      >
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

        {planPicker}
        <div className="mt-4 space-y-4">
          {proCashCallout}
          {couponField}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {localFields}
          {cuentaFields}
        </div>

        {formError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-500/10 px-3.5 py-3 text-sm leading-snug text-red-700 dark:text-red-300"
          >
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-xl bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-neutral-900"
        >
          {isSubmitting
            ? "Configurando tu restaurante..."
            : "Crear mi restaurante"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-5">
      <div
        aria-label={`Progreso del registro: paso ${stepIndex + 1} de ${B2B_STEPS.length}`}
      >
        <p
          className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase"
          aria-live="polite"
        >
          Paso {stepIndex + 1} de {B2B_STEPS.length} ·{" "}
          {B2B_STEPS[stepIndex]?.label}
        </p>
        <ol className="flex gap-2" aria-hidden>
          {B2B_STEPS.map((s, i) => {
            const active = i <= stepIndex;
            return (
              <li
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${
                  active
                    ? "bg-[var(--b2b-action)]"
                    : "bg-[var(--b2b-border)]"
                }`}
              />
            );
          })}
        </ol>
      </div>

      {step === "plan" ? (
        <div className="space-y-4">
          <div>
            <h3
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-lg font-bold text-white outline-none"
            >
              Elige tu plan
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Puedes cambiar de plan después. El cobro Pro es por transferencia o
              efectivo en early access.
            </p>
          </div>
          {planPicker}
          {proCashCallout}
          {couponField}
        </div>
      ) : null}

      {step === "local" ? (
        <div className="space-y-4">
          <div>
            <h3
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-lg font-bold text-white outline-none"
            >
              Tu local
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Así te verán comensales y el equipo en el panel.
            </p>
          </div>
          {localFields}
        </div>
      ) : null}

      {step === "cuenta" ? (
        <div className="space-y-4">
          <div>
            <h3
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-lg font-bold text-white outline-none"
            >
              Tu cuenta
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Con estos datos entras al panel de cocina y configuración.
            </p>
          </div>
          {cuentaFields}
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-500/10 px-3.5 py-3 text-sm leading-snug text-red-300"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        {step === "cuenta" ? (
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-emerald flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-80 sm:flex-1"
          >
            {isSubmitting
              ? "Configurando tu restaurante..."
              : "Crear mi restaurante"}
          </button>
        ) : (
          <button
            type="submit"
            className="btn-emerald flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-5 py-3.5 text-sm font-bold text-white sm:flex-1"
          >
            Continuar
          </button>
        )}
        {step !== "plan" ? (
          <button
            type="button"
            onClick={goBack}
            disabled={isSubmitting}
            className="btn-outline flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold sm:w-auto sm:min-w-28"
          >
            Atrás
          </button>
        ) : null}
      </div>

      {step === "cuenta" ? (
        <p className="text-center text-xs text-slate-400">
          Al registrarte aceptas nuestros{" "}
          <Link
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            términos de servicio
          </Link>{" "}
          y el{" "}
          <Link
            href="/aviso-de-privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            aviso de privacidad
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
