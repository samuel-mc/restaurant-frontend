"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  loginSuperAdmin,
  setSuperAdminToken,
} from "@/services/superadminService";
import { ApiError } from "@/services/apiClient";
import {
  saAlertError,
  saField,
  saFocusOnSurface,
  saPrimaryBtn,
} from "@/components/superadmin/superadmin-ui";

export function SuperAdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await loginSuperAdmin(email, password);
      await setSuperAdminToken(token);
      router.replace("/superadmin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message ||
              "Correo o contraseña incorrectos. Verifica e inténtalo de nuevo."
          : "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-10 w-full max-w-sm space-y-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-6 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          PlatoListo
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
          SuperAdmin
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Acceso del equipo PlatoListo a restaurantes, planes y cupones
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">
          Correo
        </span>
        <input
          type="email"
          autoComplete="username"
          required
          disabled={submitting}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${saField} ${saFocusOnSurface}`}
          placeholder="tu@platolisto.com"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">
          Contraseña
        </span>
        <input
          type="password"
          autoComplete="current-password"
          required
          disabled={submitting}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${saField} ${saFocusOnSurface}`}
        />
      </label>

      {error ? (
        <p role="alert" className={saAlertError}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full ${saPrimaryBtn} ${saFocusOnSurface}`}
      >
        {submitting ? "Entrando…" : "Entrar a SuperAdmin"}
      </button>
    </form>
  );
}
