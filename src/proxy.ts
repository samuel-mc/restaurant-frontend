import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Dominio raíz de la plataforma. En desarrollo se usa `localhost`; en producción
 * define NEXT_PUBLIC_ROOT_DOMAIN (ej. "tusass.com") para que los subdominios se
 * resuelvan correctamente.
 */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase();

/**
 * Extrae el subdominio (tenant) del host de la petición.
 * Devuelve `null` cuando la petición apunta al dominio principal o a `www`,
 * casos en los que se debe servir la landing (grupo `(marketing)`).
 */
function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  // Desarrollo local: mario.localhost -> "mario"
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }

  // Producción: mario.tusass.com -> "mario"
  if (ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub && sub !== "www" ? sub : null;
  }

  return null;
}

export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  const subdomain = extractSubdomain(host);

  // Dominio principal (localhost / tusass.com): sigue hacia la landing.
  if (!subdomain) {
    return NextResponse.next();
  }

  // Subdominio de tenant: rewrite interno e invisible hacia /[tenant].
  // "/" -> "/mario", "/menu" -> "/mario/menu", etc.
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = `/${subdomain}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(url);
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
