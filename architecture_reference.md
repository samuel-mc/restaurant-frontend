# Referencia de Arquitectura Frontend - SaaS Multi-Tenant de Restaurantes

Este documento sirve como la especificación de referencia y guía de diseño técnico para el desarrollo del frontend de la plataforma SaaS.

---

## 🎯 1. Estrategia Multi-Tenant (Subdominios Dinámicos)

La aplicación resuelve dinámicamente el tenant (restaurante) a partir de la URL
utilizando el **proxy de Next.js 16** (`src/proxy.ts`, sucesor de `middleware.ts`).
Esta es la arquitectura oficial y definitiva; se descarta por completo el patrón
`_tenants`.

### Flujo de Resolución de URL
```mermaid
graph TD
    A[Petición del Cliente] --> B[proxy.ts de Next.js 16]
    B --> C{¿Es subdominio del host principal?}
    C -->|No: localhost o tusass.com| D[Landing global · Route Group (marketing)]
    C -->|Sí: tenant.localhost o tenant.tusass.com| E{¿Es ruta /admin/*?}
    E -->|Sí: /admin/*| F[next() + inyecta cabecera x-tenant-slug → (admin)]
    E -->|No: / o /menu o /orders| G[rewrite invisible → (public)/[tenant]/*]
```

### Configuración del proxy
- Extrae el host de `x-forwarded-host` (producción en Render/Vercel) con `host`
  como fallback (desarrollo).
- Identifica si es un subdominio válido (distinto de `www`, `app` o del dominio
  principal). Si no lo es, deja pasar el tráfico a la landing `(marketing)`.
- **Zona pública** (`/`, `/menu`, `/orders/[uuid]`): `NextResponse.rewrite`
  interno e invisible hacia el Route Group `(public)/[tenant]/...`, manteniendo
  limpia la URL en el navegador.
- **Zona admin** (`/admin/*`): NO se reescribe (ya existe en el Route Group
  `(admin)`); se usa `NextResponse.next` inyectando la cabecera interna
  `x-tenant-slug` para propagar el contexto del tenant a los Server Components
  (leíble con `headers()`).

---

## 📁 2. Estructura de Directorios Propuesta (App Router)

Separamos las responsabilidades del Comensal y del Administrador mediante los
Route Groups `(public)` y `(admin)`, que no aparecen en la URL. El tenant llega
por subdominio: como parámetro `[tenant]` en la zona pública y como cabecera
`x-tenant-slug` en la zona admin.

```text
src/
├── proxy.ts                          # Interceptor de subdominios (rewrites + x-tenant-slug)
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── globals.css
│   ├── (marketing)/                  # Dominio principal (localhost:3000 / tusass.com)
│   │   └── page.tsx                  # Landing page del SaaS
│   ├── (public)/[tenant]/            # Zona del Comensal (reescrita por el proxy)
│   │   ├── page.tsx                  # Sitio institucional del restaurante
│   │   ├── menu/page.tsx             # Menú digital interactivo + carrito
│   │   └── orders/[uuid]/page.tsx    # Tracking del pedido en tiempo real (WebSockets)
│   └── (admin)/admin/                # Zona del Administrador (contexto vía x-tenant-slug)
│       ├── login/page.tsx            # Autenticación administrativa (JWT)
│       └── dashboard/
│           ├── page.tsx              # Panel de cocina/caja (comandas en tiempo real)
│           ├── menu/page.tsx         # Gestión de platillos, precios y stock
│           └── settings/page.tsx     # Identidad de marca, horarios y módulos
├── components/                       # Componentes compartidos y atómicos
│   ├── ui/                           # Componentes visuales genéricos
│   ├── marketing/                    # Landing del SaaS
│   ├── customer/                     # Componentes del menú del comensal
│   └── admin/                        # Componentes del dashboard
├── services/                         # Cliente HTTP (apiClient) + servicios de dominio
├── store/                            # Zustand stores (carrito, etc.)
├── lib/                              # Utilidades (formato de moneda, helpers)
├── hooks/                            # Custom hooks (useWebSocket, etc.)
├── context/                          # React Context para estado global ligero (opcional)
└── types/                            # Tipado estricto del backend
```

---

## 📐 3. Reglas Técnicas y Restricciones Obligatorias

### 1. Tipado TypeScript Estricto
- Queda prohibido el uso de `any`. Todos los tipos provenientes del Backend (Spring Boot) deben tener sus correspondientes interfaces definidas en `types/`.
- Tipar explícitamente los payloads de llamadas de API y eventos de WebSocket.

### 2. Estilos con Tailwind CSS (Mobile-First)
- **Comensal (Público):** Diseñado con enfoque exclusivo en dispositivos móviles. Interfaz táctil, botones de acción rápida accesibles con el pulgar, carga ultra rápida.
- **Administrador (Privado):** Layout responsivo apto para tablets (cocineros/camareros) y desktops (administradores).
- Paleta de colores armoniosa, uso de gradients sutiles y micro-animaciones en acciones táctiles (ej. agregar al carrito).

### 3. Consumo Stateless de API y Seguridad
- Toda petición al backend se realiza de manera stateless mediante REST.
- **Rutas de Admin:** El token JWT obtenido en el login se almacenará de manera segura. Se evaluará el uso de Cookies HTTP-only para mitigar XSS o localStorage si es necesario, enviando siempre el token en la cabecera `Authorization: Bearer <token>`.
- Las llamadas se centralizarán en un cliente fetch/axios con interceptores para manejar renovación de tokens o expiraciones (401).

### 4. Manejo de Precios y Precisión Decimal
- En el cliente, los precios se operan como `number` de punto flotante para operaciones rápidas, pero al enviarse al backend o procesarse para cálculos críticos, se mantendrán como decimales precisos.
- Formateo consistente de moneda mediante utilidades globales (ej. `Intl.NumberFormat`).

### 5. Arquitectura Server vs. Client Components (RSC)
- **RSC (Server Components) por defecto:** La carga de datos iniciales del menú del restaurante (categorías, platillos) se hará en Server Components para mejorar el SEO y rendimiento de carga inicial.
- **Client Components ('use client') seleccionados:** Solo para componentes con interactividad:
  - Botones "Agregar al carrito"
  - Modal del Carrito
  - Panel de pedidos de cocina (por el uso de WebSocket)
  - Formularios de login y gestión

---

## 🔌 4. Estrategia de Tiempo Real (WebSockets)

Para el Panel del Administrador (Cocina y Caja), el flujo de pedidos funcionará en tiempo real:
- Conexión persistente mediante WebSocket nativo o STOMP sobre WebSockets (dependiendo de la configuración del backend Spring Boot).
- Reconexión automática con backoff exponencial ante caídas de red.
- Mutación de estado optimista en el cliente para el cambio de estado de platillos (agotados/activos).
