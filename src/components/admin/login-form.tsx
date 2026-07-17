"use client";

/**
 * Formulario de acceso al panel admin (por tenant).
 *
 * Valida credenciales en cliente, autentica contra Spring Boot con `X-Tenant`
 * y persiste el JWT en cookie HttpOnly antes de redirigir al dashboard.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getLoginErrorMessage,
  login,
  setToken,
} from "@/services/authService";

interface LoginFormProps {
  /** Slug del restaurante resuelto en el Server Component vía `x-tenant-slug`. */
  tenantSlug: string;
  /** Nombre legible para la UI (opcional). */
  restaurantLabel: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = "Ingresa tu correo electrónico.";
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = "El correo no tiene un formato válido.";
  }

  if (!password) {
    errors.password = "Ingresa tu contraseña.";
  } else if (password.length < 6) {
    errors.password = "La contraseña debe tener al menos 6 caracteres.";
  }

  return errors;
}

export function LoginForm({ tenantSlug, restaurantLabel }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const token = await login({ email, password }, tenantSlug);
      await setToken(token);
      router.replace("/admin/dashboard");
      router.refresh();
    } catch (error) {
      setFormError(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col gap-5 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-900"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
          Acceso seguro
        </p>
        <h2 className="text-lg font-bold text-foreground">{restaurantLabel}</h2>
        <p className="text-sm text-black/55 dark:text-white/55">
          Usa las credenciales de administrador de este local.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Correo electrónico</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            required
            disabled={isSubmitting}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className="rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-amber-500/30 transition focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
            placeholder="admin@restaurante.com"
          />
          {fieldErrors.email ? (
            <span id="email-error" className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.email}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            className="rounded-xl border border-black/10 bg-black/2 px-3.5 py-2.5 text-sm outline-none ring-amber-500/30 transition focus:ring-2 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
            placeholder="••••••••"
          />
          {fieldErrors.password ? (
            <span
              id="password-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {fieldErrors.password}
            </span>
          ) : null}
        </label>
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-500/10 px-3.5 py-3 text-sm leading-snug text-red-700 dark:text-red-300"
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-neutral-900"
      >
        {isSubmitting ? "Iniciando sesión..." : "Entrar al panel"}
      </button>
    </form>
  );
}
