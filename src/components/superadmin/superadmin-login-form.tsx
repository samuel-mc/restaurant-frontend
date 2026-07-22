"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  loginSuperAdmin,
  setSuperAdminToken,
} from "@/services/superadminService";
import { ApiError } from "@/services/apiClient";

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
          ? err.message || "Credenciales inválidas."
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-6 shadow-2xl shadow-black/40"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          PlatoListo
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
          SuperAdmin
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Backoffice global de la plataforma
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
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
          placeholder="superadmin@platolisto.com"
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
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
      >
        {submitting ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
