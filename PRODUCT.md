# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dueños / gerentes de restaurante:** configuran marca, menú, horarios y módulos; operan cocina/caja en tablet o desktop durante el servicio.
- **Comensales:** en mesa o en el local, abren el menú digital por QR (mobile-first) y siguen el pedido en tiempo real.
- **Equipo PlatoListo (operación):** entrega landings institucionales Pro a medida y publica sitios bajo demanda.

## Product Purpose

PlatoListo es un SaaS multi-tenant para restaurantes. Cada local opera en su propio subdominio (y, a futuro, dominio custom) con:

1. Website institucional propio (cuando está publicado y entregado).
2. Menú digital + carrito (QR).
3. Panel admin con cocina/caja en tiempo real.

Éxito: un tenant nuevo puede registrarse, configurar marca, cargar menú, recibir pedidos, gestionar cocina en vivo y que el comensal trackee el pedido.

## Positioning

No es solo un menú QR genérico ni una plantilla compartida masiva. El diferenciador confirmado: **sitio institucional exclusivo por restaurante** (plan Pro + setup; landing custom entregada por el equipo) más **operación en vivo** (pedidos + cocina vía WebSockets) en el mismo producto multi-tenant.

## Operating Context

- Resolución de tenant por host (`src/proxy.ts`): subdominio → `(public)/[tenant]` o `(admin)` con cabecera `x-tenant-slug`.
- Dominio raíz sin subdominio → landing SaaS `(marketing)`.
- Comensal: móvil en mesa; admin: tablet cocina / desktop gestión.
- Backend Spring Boot (REST + WebSockets/STOMP); frontend Next.js 16 App Router.
- Publicación de sitio: `websitePublished` en perfil + entrada en `tenant-landings` para la landing custom.

## Capabilities and Constraints

**Confirmado**

- Arquitectura oficial: Next.js 16, `proxy.ts`, route groups `(marketing)` / `(public)` / `(admin)`; sin patrón `_tenants`.
- Módulos: marketing SaaS, catálogo/menú, pedidos/carrito, admin (JWT HttpOnly, cocina WS, settings, ABM menú).
- Planes Básico / Pro (gates de sitio Pro, límites de platillos en Básico); pago / cupón early access.
- Website institucional **exclusivo por tenant**; no multi-template genérico. La Trattoria es demo entregado (`latrattoria` / `la-trattoria`), no plantilla de todos.
- TypeScript estricto; precios como `number` + formateo con `Intl.NumberFormat`.
- Comensal mobile-first; admin responsivo tablet/desktop.

**Abierto / no fijado aún**

- Dominios custom por restaurante (viable en arquitectura; implementación pendiente).
- Estándar formal de accesibilidad (WCAG AA u otro) — aún no requisito explícito.
- Smoke E2E completo del loop pedido → cocina → tracking (pendiente en roadmap).

## Brand Commitments

- Nombre de producto: **PlatoListo**.
- Voz operativa en español (MX): clara, directa, orientada a restauranteros y comensales.
- Identidad visual del SaaS vs. identidad de cada restaurante: las landings Pro llevan la marca del local, no la del SaaS.

## Evidence on Hand

- Landing SaaS: `src/components/marketing/b2b-landing.tsx`, ruta `(marketing)`.
- Demo institucional: `RestaurantLanding` registrada en `src/lib/tenant-landings.ts` para `latrattoria` / `la-trattoria`.
- Menú digital, carrito Zustand, tracking y cocina: rutas bajo `(public)` y `(admin)`.
- Specs: `architecture_reference.md`, `FRONTEND_ROADMAP.md`.
- No inventar testimonios, métricas de clientes ni pricing no confirmados en UI futura.

## Product Principles

1. **Un restaurante, un sitio** — el contenido institucional no se reutiliza entre tenants.
2. **QR para pedir, panel para operar** — el comensal pide y trackea; el local cocina y gestiona en el mismo sistema.
3. **Subdominio primero** — el tenant vive en la URL; el dominio custom es alias opcional futuro.
4. **Mobile en mesa, claridad en cocina** — diseño y UX siguen el contexto de uso real.
5. **Hechos sobre promesas** — no fabricar prueba social ni claims de producto no confirmados.

## Accessibility & Inclusion

Sin estándar formal fijado todavía. Preservar contraste usable y targets táctiles en menú móvil; elevar a WCAG u otro cuando se decida explícitamente.
