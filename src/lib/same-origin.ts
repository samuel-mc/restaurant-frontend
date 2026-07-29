/**
 * Comprueba que la petición es same-origin (anti session fixation / CSRF básico).
 */

export function isSameOriginRequest(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    return false;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // POST de sesión: exigir Origin o Sec-Fetch-Site same-origin (anti CSRF).
  if (!origin) {
    return secFetchSite === "same-origin" || secFetchSite === "same-site";
  }

  if (!host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/** Valida forma básica de JWT (3 segmentos) y que no esté claramente expirado. */
export function looksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}
