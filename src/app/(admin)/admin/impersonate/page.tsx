"use client";

/**
 * Handoff de impersonación en el subdominio del tenant.
 * Recibe un código de un solo uso (?code=) y lo canjea por cookie HttpOnly.
 * El JWT no viaja en el hash ni queda expuesto a scripts de la página.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const EXCHANGE_PATH = "/api/auth/impersonate";
const CODE_STORAGE_KEY = "pl_impersonate_code";
const DONE_STORAGE_PREFIX = "pl_impersonate_done:";

/** Un canje por código (Strict Mode / remounts no deben POST duplicado). */
const exchangesByCode = new Map<string, Promise<void>>();

function tenantSlugFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && sub !== "www" && sub !== "app" ? sub : null;
  }
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase();
  if (root && hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(root.length + 1));
    return sub && sub !== "www" && sub !== "app" ? sub : null;
  }
  return null;
}

function exchangeImpersonationCode(code: string, tenantSlug: string): Promise<void> {
  return fetch(EXCHANGE_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-tenant-slug": tenantSlug,
    },
    body: JSON.stringify({ code }),
    credentials: "same-origin",
  }).then(async (response) => {
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        data?.error || "No se pudo establecer la sesión de soporte.",
      );
    }
  });
}

function getOrStartExchange(code: string, tenantSlug: string): Promise<void> {
  const existing = exchangesByCode.get(code);
  if (existing) return existing;

  const started = exchangeImpersonationCode(code, tenantSlug).then(() => {
    try {
      sessionStorage.setItem(`${DONE_STORAGE_PREFIX}${code}`, "1");
      sessionStorage.removeItem(CODE_STORAGE_KEY);
    } catch {
      // private mode
    }
  });
  exchangesByCode.set(code, started);
  return started;
}

function ImpersonateHandoff() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("code")?.trim() ?? "";
    if (fromUrl) {
      try {
        sessionStorage.setItem(CODE_STORAGE_KEY, fromUrl);
      } catch {
        // private mode
      }
      window.history.replaceState(null, "", window.location.pathname);
    }

    let code = fromUrl;
    if (!code) {
      try {
        code = sessionStorage.getItem(CODE_STORAGE_KEY)?.trim() ?? "";
      } catch {
        code = "";
      }
    }

    if (!code) {
      setError("Falta el código de impersonación.");
      return;
    }

    try {
      if (sessionStorage.getItem(`${DONE_STORAGE_PREFIX}${code}`) === "1") {
        router.replace("/admin/dashboard");
        router.refresh();
        return;
      }
    } catch {
      // continue to exchange
    }

    const tenantSlug = tenantSlugFromHost();
    if (!tenantSlug) {
      setError("No se pudo identificar el restaurante en este dominio.");
      return;
    }

    let cancelled = false;
    void getOrStartExchange(code, tenantSlug)
      .then(() => {
        if (cancelled) return;
        router.replace("/admin/dashboard");
        router.refresh();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo establecer la sesión de soporte.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-center">
      {error ? (
        <div className="max-w-sm space-y-3">
          <p className="text-sm font-medium text-red-300">{error}</p>
          <a
            href="/admin/login"
            className="inline-block text-sm text-zinc-400 underline"
          >
            Ir al login
          </a>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Preparando sesión de soporte…</p>
      )}
    </div>
  );
}

export default function AdminImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-center">
          <p className="text-sm text-zinc-400">Preparando sesión de soporte…</p>
        </div>
      }
    >
      <ImpersonateHandoff />
    </Suspense>
  );
}
