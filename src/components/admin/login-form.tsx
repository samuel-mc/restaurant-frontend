"use client";

/**
 * Formulario de acceso al panel admin (por tenant).
 *
 * Valida credenciales en cliente, autentica contra Spring Boot con `X-Tenant`
 * y persiste el JWT en cookie HttpOnly antes de redirigir al dashboard.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type ModifierKey,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { whatsappChatUrl } from "@/lib/contact-links";
import {
  getLoginErrorMessage,
  login,
  setToken,
} from "@/services/authService";
import { ApiError } from "@/services/apiClient";

const SUPPORT_MAIL = "hola@platolisto.com";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-live focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const fieldClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm outline-none transition focus-visible:border-live focus-visible:ring-2 focus-visible:ring-live/20 disabled:opacity-60";

interface LoginFormProps {
  /** Slug del restaurante resuelto en el Server Component vía `x-tenant-slug`. */
  tenantSlug: string;
  /** Nombre del local (para prefill de ayuda). */
  restaurantName?: string;
  /** WhatsApp del perfil público, si existe. */
  whatsapp?: string | null;
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
  }

  return errors;
}

function readCapsLock(event: object): boolean {
  try {
    const getModifierState = (
      event as { getModifierState?: (key: ModifierKey) => boolean }
    ).getModifierState;
    return getModifierState?.("CapsLock") ?? false;
  } catch {
    return false;
  }
}

export function LoginForm({
  tenantSlug,
  restaurantName,
  whatsapp = null,
}: LoginFormProps) {
  const router = useRouter();
  const formErrorId = useId();
  const accessRecoveryId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const capsHintId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showAccessRecovery, setShowAccessRecovery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const localName = restaurantName?.trim() || tenantSlug;

  const helpWhatsApp = whatsappChatUrl(whatsapp, {
    text: `Hola, necesito ayuda para entrar a cocina de ${localName} (${tenantSlug}).`,
  });

  const supportMailto = `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(
    `Acceso cocina · ${tenantSlug}`,
  )}&body=${encodeURIComponent(
    `Hola, no puedo entrar al panel de cocina.\nLocal: ${localName}\nSlug: ${tenantSlug}\n`,
  )}`;

  const passwordDescribedBy = [
    fieldErrors.password ? passwordErrorId : null,
    capsLockOn ? capsHintId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const formDescribedBy = [
    formError ? formErrorId : null,
    formError && showAccessRecovery ? accessRecoveryId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  useEffect(() => {
    if (!passwordFocused) return;

    function onWindowKey(event: globalThis.KeyboardEvent) {
      setCapsLockOn(event.getModifierState("CapsLock"));
    }

    window.addEventListener("keydown", onWindowKey);
    window.addEventListener("keyup", onWindowKey);
    return () => {
      window.removeEventListener("keydown", onWindowKey);
      window.removeEventListener("keyup", onWindowKey);
    };
  }, [passwordFocused]);

  function clearFormError() {
    if (formError) setFormError(null);
    if (showAccessRecovery) setShowAccessRecovery(false);
  }

  function syncCapsFromFieldEvent(
    event:
      | KeyboardEvent<HTMLInputElement>
      | FocusEvent<HTMLInputElement>
      | ChangeEvent<HTMLInputElement>,
  ) {
    setCapsLockOn(readCapsLock(event));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setShowAccessRecovery(false);
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await login({ email, password }, tenantSlug);
      await setToken(token);
      router.replace("/admin/dashboard");
      router.refresh();
      // Busy stays true until navigation unmounts the form.
    } catch (error) {
      setFormError(getLoginErrorMessage(error));
      setShowAccessRecovery(
        error instanceof ApiError &&
          (error.status === 401 || error.status === 403),
      );
      setIsSubmitting(false);
      queueMicrotask(() => formErrorRef.current?.focus());
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isSubmitting}
        aria-describedby={formDescribedBy}
        className="flex w-full flex-col gap-4"
      >
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">Correo electrónico</span>
          <input
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            required
            maxLength={254}
            disabled={isSubmitting}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFormError();
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            className={fieldClass}
            placeholder="tu@correo.com"
          />
          {fieldErrors.email ? (
            <span
              id={emailErrorId}
              className="text-xs font-medium text-destructive"
            >
              {fieldErrors.email}
            </span>
          ) : null}
        </label>

        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">Contraseña</span>
          <div className="relative">
            <input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={isSubmitting}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFormError();
                syncCapsFromFieldEvent(event);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              onFocus={(event) => {
                setPasswordFocused(true);
                syncCapsFromFieldEvent(event);
              }}
              onKeyDown={(event) => syncCapsFromFieldEvent(event)}
              onKeyUp={(event) => syncCapsFromFieldEvent(event)}
              onBlur={() => {
                setPasswordFocused(false);
                setCapsLockOn(false);
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={passwordDescribedBy}
              className={`${fieldClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isSubmitting}
              className={`absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 ${focusRing} focus-visible:ring-inset`}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="size-4 shrink-0" aria-hidden />
              ) : (
                <Eye className="size-4 shrink-0" aria-hidden />
              )}
            </button>
          </div>
          {capsLockOn ? (
            <span
              id={capsHintId}
              role="status"
              className="text-xs font-medium text-warn-ink"
            >
              Bloq Mayús está activado.
            </span>
          ) : null}
          {fieldErrors.password ? (
            <span
              id={passwordErrorId}
              className="text-xs font-medium text-destructive"
            >
              {fieldErrors.password}
            </span>
          ) : null}
        </label>

        {formError ? (
          <div className="flex flex-col gap-2">
            <p
              ref={formErrorRef}
              id={formErrorId}
              role="alert"
              tabIndex={-1}
              className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-medium leading-snug text-destructive outline-none [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              {formError}
            </p>
            {showAccessRecovery ? (
              <p
                id={accessRecoveryId}
                className="text-sm leading-snug text-muted-foreground"
              >
                El acceso lo otorga quien administra este local.
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`mt-1 min-h-12 w-full rounded-xl bg-live px-4 py-3 text-base font-bold text-live-foreground shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-[transform,filter,opacity] hover:brightness-110 motion-safe:active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 disabled:hover:brightness-100 ${focusRing}`}
        >
          {isSubmitting ? "Entrando…" : "Entrar a cocina"}
        </button>
      </form>

      <div className="flex flex-col gap-4 border-t border-border pt-5 text-sm leading-snug sm:text-left">
        <p className="text-center text-muted-foreground">
          ¿Sin acceso? Pídeselo al administrador del local <br />
          <a
            href={supportMailto}
            className={`rounded-sm font-semibold text-live-ink underline-offset-2 hover:underline ${focusRing}`}
          >
            Soporte
          </a>
          {" · "}
          <Link
            href="/staff/login"
            className={`rounded-sm font-semibold text-live-ink underline-offset-2 hover:underline ${focusRing}`}
          >
            Acceso para el equipo
          </Link>
        </p>

        <details className="group text-left text-muted-foreground">
          <summary
            className={`flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium marker:content-none underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <ChevronDown
              className="size-4 shrink-0 transition-transform motion-safe:group-open:rotate-180"
              aria-hidden
            />
            Salidas
          </summary>
          <div className="mt-1 flex flex-col gap-2 pl-5">
            <p>
              <Link
                href="/menu"
                className={`rounded-sm font-semibold text-foreground underline-offset-2 hover:underline ${focusRing}`}
              >
                Ir al menú
              </Link>
              <span aria-hidden> · </span>
              <Link
                href="/"
                className={`rounded-sm font-semibold text-foreground underline-offset-2 hover:underline ${focusRing}`}
              >
                Sitio del local
              </Link>
            </p>
            <p>
              ¿No es este restaurante? Estás en la cocina de{" "}
              <span className="font-medium text-foreground">{localName}</span>.
              Abre el panel desde el enlace de tu local.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
