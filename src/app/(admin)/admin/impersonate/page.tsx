"use client";

/**
 * Handoff de impersonación en el subdominio del tenant.
 * El JWT viaja en el hash (no se envía al servidor ni queda en logs de Next).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/services/authService";

export default function AdminImpersonatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "").trim();
    const token = decodeURIComponent(raw);
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      setError("Falta el token de impersonación.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await setToken(token);
        if (cancelled) return;
        router.replace("/admin/dashboard");
        router.refresh();
      } catch {
        if (!cancelled) {
          setError("No se pudo establecer la sesión de soporte.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
