import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Dominio raíz de la plataforma. En desarrollo se usa `localhost`; en producción
 * define NEXT_PUBLIC_ROOT_DOMAIN (ej. "tusass.com") para que los subdominios se
 * resuelvan correctamente.
 */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase();

/**
 * Cabecera interna con la que el proxy propaga el tenant resuelto a los
 * Server Components (leíble con `headers()` desde `src/app/(admin)/**`).
 * No confundir con `X-Tenant`, que es la cabecera hacia el backend Spring Boot.
 */
export const TENANT_HEADER = "x-tenant-slug";

/** Subdominios reservados que NO representan a un restaurante (tenant). */
const RESERVED_SUBDOMAINS = new Set(["www", "app"]);

/**
 * Extrae el subdominio (tenant) del host de la petición.
 * Devuelve `null` cuando la petición apunta al dominio principal o a un
 * subdominio reservado, casos en los que se sirve la landing (grupo `(marketing)`).
 */
function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  // Desarrollo local: mario.localhost -> "mario"
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null;
  }

  // Producción: mario.tusass.com -> "mario"
  if (ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : null;
  }

  return null;
}

export function proxy(request: NextRequest): NextResponse {
  // En producción (Render/Vercel) el host real llega en `x-forwarded-host`;
  // `host` sirve como fallback en desarrollo o tras proxies simples.
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  const subdomain = extractSubdomain(host);

  // Dominio principal (localhost / tusass.com): landing global de `(marketing)`.
  if (!subdomain) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Propaga el tenant resuelto a los Server Components mediante una cabecera
  // interna. Imprescindible para la zona admin, cuyas rutas no llevan `[tenant]`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HEADER, subdomain);

  // Zona privada: `/admin/*` ya vive en el route group `(admin)`.
  // Mantenemos la URL tal cual e inyectamos el contexto del tenant por cabecera.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Zona pública: rewrite interno e invisible hacia `(public)/[tenant]/...`.
  // "/" -> "/mario", "/menu" -> "/mario/menu", etc.
  const url = request.nextUrl.clone();
  url.pathname = `/${subdomain}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas EXCEPTO:
     * - api            (rutas de API internas)
     * - _next/static   (assets de build)
     * - _next/image    (optimización de imágenes)
     * - favicon.ico, robots.txt, sitemap.xml (archivos de metadata)
     * Esto evita bucles de rewrite y que el proxy bloquee CSS/JS/imágenes.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
