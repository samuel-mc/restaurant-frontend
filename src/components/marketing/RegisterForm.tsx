"use client";

/**
 * Formulario de onboarding SaaS B2B: crea restaurante + owner.
 */

import { useMemo, useState, type FormEvent } from "react";
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
};

export function RegisterForm() {
  const [form, setForm] = useState<RegisterTenantDTO>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const previewHost = useMemo(() => {
    const slug = form.tenantSlug.trim().toLowerCase() || "tu-restaurante";
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname.endsWith(".localhost"));
    return isLocal ? `${slug}.localhost:3000` : `${slug}.${ROOT_DOMAIN}`;
  }, [form.tenantSlug]);

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
      setForm(EMPTY_FORM);
      setFieldErrors({});
    } catch (error) {
      setFormError(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdSlug) {
    const panelUrl = buildAdminLoginUrl(createdSlug);
    return (
      <section
        aria-live="polite"
        className="w-full rounded-3xl border border-emerald-500/25 bg-white p-6 text-left shadow-sm dark:border-emerald-400/20 dark:bg-neutral-900 sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          Listo
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
          ¡Tu restaurante ha sido creado con éxito!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-black/60 dark:text-white/60">
          Ya puedes entrar al panel de{" "}
          <span className="font-semibold text-foreground">{createdSlug}</span>{" "}
          con el correo y la contraseña que acabas de registrar.
        </p>
        <a
          href={panelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-transform active:scale-[0.98] sm:w-auto"
        >
          Ir a mi Panel de Control
        </a>
        <button
          type="button"
          onClick={() => setCreatedSlug(null)}
          className="mt-3 block w-full text-center text-sm font-medium text-black/50 transition hover:text-foreground dark:text-white/50 sm:mt-4 sm:w-auto sm:text-left"
        >
          Registrar otro restaurante
        </button>
      </section>
    );
  }

  return (
    <form
      id="registro"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Nombre del restaurante</span>
          <input
            type="text"
            name="restaurantName"
            autoComplete="organization"
            disabled={isSubmitting}
            value={form.restaurantName}
            onChange={(e) => updateField("restaurantName", e.target.value)}
            className="rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-neutral-900/20 focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
            placeholder="La Parrilla de Mario"
          />
          {fieldErrors.restaurantName ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.restaurantName}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Subdominio deseado</span>
          <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-black/10 focus-within:ring-2 focus-within:ring-neutral-900/20 dark:border-white/10">
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
              className="min-w-0 flex-1 bg-black/2 px-3.5 py-2.5 text-sm outline-none disabled:opacity-60 dark:bg-white/5"
              placeholder="mario"
              aria-describedby="slug-preview"
            />
            <span className="shrink-0 bg-black/5 px-3 py-2.5 text-sm text-black/50 dark:bg-white/10 dark:text-white/50">
              .{ROOT_DOMAIN}
            </span>
          </div>
          <p
            id="slug-preview"
            className="text-xs text-black/50 dark:text-white/50"
          >
            Tu sitio será:{" "}
            <span className="font-semibold text-foreground">{previewHost}</span>
          </p>
          {fieldErrors.tenantSlug ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.tenantSlug}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Tu nombre</span>
          <input
            type="text"
            name="ownerName"
            autoComplete="name"
            disabled={isSubmitting}
            value={form.ownerName}
            onChange={(e) => updateField("ownerName", e.target.value)}
            className="rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-neutral-900/20 focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
            placeholder="Mario López"
          />
          {fieldErrors.ownerName ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.ownerName}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Correo del administrador</span>
          <input
            type="email"
            name="ownerEmail"
            autoComplete="email"
            disabled={isSubmitting}
            value={form.ownerEmail}
            onChange={(e) => updateField("ownerEmail", e.target.value)}
            className="rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-neutral-900/20 focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
            placeholder="mario@parrilla.com"
          />
          {fieldErrors.ownerEmail ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.ownerEmail}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            name="ownerPassword"
            autoComplete="new-password"
            disabled={isSubmitting}
            value={form.ownerPassword}
            onChange={(e) => updateField("ownerPassword", e.target.value)}
            className="rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-neutral-900/20 focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
            placeholder="Mínimo 8 caracteres"
          />
          {fieldErrors.ownerPassword ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.ownerPassword}
            </span>
          ) : null}
        </label>
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
          ? "Creando infraestructura de tu restaurante..."
          : "Crear mi restaurante"}
      </button>
    </form>
  );
}
