import { ApiError } from "@/services/apiClient";

/**
 * Mensaje operable para el panel admin (español MX).
 * Evita URLs, códigos HTTP crudos y jerga de red en la UI.
 */
export function getAdminErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.statusText === "Configuration Error") {
      return "Falta configuración del servidor. Contacta a soporte PlatoListo.";
    }
    if (error.isNetworkError) {
      if (error.statusText === "Timeout") {
        return "La operación tardó demasiado. Revisa la conexión e inténtalo de nuevo.";
      }
      return "Sin conexión con el servidor. Revisa la red e inténtalo de nuevo.";
    }
    if (error.status === 401) {
      return "Tu sesión expiró. Vuelve a iniciar sesión.";
    }
    if (error.status === 403) {
      return "No tienes permiso para esta acción.";
    }
    if (error.status === 404) {
      const msg = error.message?.trim();
      if (msg && !isTechnicalApiMessage(msg)) return msg;
      return "No encontramos ese recurso. Actualiza e inténtalo de nuevo.";
    }
    if (error.status === 409) {
      const msg = error.message?.trim();
      if (msg && !isTechnicalApiMessage(msg)) return msg;
      return "El estado cambió. Actualiza e inténtalo de nuevo.";
    }
    if (error.status === 429) {
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    }
    if (error.status >= 500) {
      return "El servidor no respondió bien. Inténtalo de nuevo en unos segundos.";
    }
    const msg = error.message?.trim();
    if (msg && !isTechnicalApiMessage(msg)) return msg;
    return fallback;
  }
  if (error instanceof Error) {
    const msg = error.message?.trim();
    if (msg && !isTechnicalApiMessage(msg)) return msg;
  }
  return fallback;
}

function isTechnicalApiMessage(message: string): boolean {
  return (
    /https?:\/\//i.test(message) ||
    /excedió el tiempo límite/i.test(message) ||
    /falló con estado \d+/i.test(message) ||
    /No se pudo conectar con el backend/i.test(message) ||
    /NEXT_PUBLIC_/i.test(message) ||
    /^Request failed/i.test(message) ||
    /\bECONNREFUSED\b/i.test(message)
  );
}
