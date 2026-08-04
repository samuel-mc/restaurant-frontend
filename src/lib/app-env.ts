/** Perfil de despliegue del frontend (local / qa / production). */
export type AppEnv = "local" | "qa" | "production";

export function getAppEnv(): AppEnv {
  const raw = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (raw === "qa" || raw === "production") return raw;
  if (process.env.NODE_ENV === "development") return "local";
  return "production";
}

export function isQa(): boolean {
  return getAppEnv() === "qa";
}
