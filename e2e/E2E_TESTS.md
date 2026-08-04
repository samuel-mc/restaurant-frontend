# Catálogo de pruebas E2E — PlatoListo

Registro de smokes automatizados (Playwright) y de pruebas sugeridas para ampliar cobertura del loop operativo y del SaaS.

**Cómo correr lo automatizado**

```bash
# Backend: docker compose up (restaurant-backend) → :8080 + restaurant-db
# Frontend: npm run dev → :3000
cd restaurant-frontend
npx playwright install chromium   # solo la primera vez / tras actualizar Playwright
npm run test:e2e
```

- Config: [`playwright.config.ts`](../playwright.config.ts)
- Setup tenant: [`global-setup.ts`](./global-setup.ts) (tenant `e2esmoke`, Pro vía SQL, pickup+delivery, producto, staff PIN)
- Credenciales / overrides: [`fixtures/env.ts`](./fixtures/env.ts), [`env.example`](./env.example)

---

## Ejecutadas (automatizadas)

| ID | Nombre | Spec | Resultado | Notas |
|---|---|---|---|---|
| **E2E-01** | Loop operativo PICKUP | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | Menú → carrito → pedido → tracking **Recibido** → cocina **Aceptar** → tracking **Confirmado** por WebSocket (sin reload). Dual browser context (comensal + cocina). |
| **E2E-02** | Loop completo hasta Entregado | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | Aceptar → Cocinar → Listo; tracking **Confirmado** → **Preparando** → **Entregado**. Enfoca pestaña de etapa (`#kitchen-tab-*`) antes de cada avance. |
| **E2E-03** | Pedido IN_TABLE con QR | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | `POST /admin/table-qr/sign` → `/menu?m=&t=` → pedido mesa → cocina ve **Mesa N** → Aceptar → tracking **Confirmado**. |
| **E2E-04** | Cobrar y cerrar | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | PICKUP hasta **Entregado** → Por cobrar → **Cobrar** → tracking **Cuenta cerrada**. |
| **E2E-05** | Pre-cuenta / ticket | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | IN_TABLE → salón → modal pre-cuenta → **Imprimir** (print stub + afterprint). |
| **E2E-06** | WS caído / reconexión | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | CDP `Network.setBlockedURLs` (`*ws-orders*`) → hint degradación → unblock + reload → **En vivo** → Accept → **Confirmado**. |
| **E2E-07** | Staff PIN MESERO/COCINA | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | `/staff/login` → PIN → MESERO a salón, COCINA a cocina. Staff sembrado en globalSetup. |
| **E2E-08** | Llamar mesero | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | Menú QR → FAB Ayuda → aviso WS en salón (**Llaman al mesero**). Salón abierto antes del FAB. |
| **E2E-09** | Unir mesas | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | Mesas 8+9 con cuenta → Unir → **Mesa 8-9** en salón y ticket cocina. |
| **E2E-10** | Delivery | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | Canal **A domicilio** + dirección → ticket cocina con Dir. → Accept → **Confirmado**. |
| **E2E-11** | ABM menú | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | API crea → visible en `/menu` → toggle Agotado/En menú → delete → desaparece. |
| **E2E-12** | Modificadores | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | Grupo obligatorio → error sin opción → Grande (+delta) → subtotal base+delta. |
| **E2E-13** | Límite Basic | [`smoke-ops-loop.spec.ts`](./smoke-ops-loop.spec.ts) | Verde (local) | SQL BASIC → 31.º POST 400 + mensaje · UI `30/30` + Nuevo disabled · restaura PRO. |
| **E2E-14** | Registro onboarding | [`smoke-saas.spec.ts`](./smoke-saas.spec.ts) | Verde (local) | Landing `#registro` → slug nuevo → success → login admin. Reinicia backend si rate-limit in-memory. |
| **E2E-15** | Cupón Pro | [`smoke-saas.spec.ts`](./smoke-saas.spec.ts) | Verde (local) | Demote BASIC + clear cupón → redeem UI → success · restaura PRO. |
| **E2E-16** | Pedido no encontrado | [`smoke-saas.spec.ts`](./smoke-saas.spec.ts) | Verde (local) | UUID inválido → empty `order-unavailable` (sin Reintentar) → link menú. |
| **E2E-17** | Menú sin ordering | [`smoke-saas.spec.ts`](./smoke-saas.spec.ts) | Verde (local) | `orderingEnabled=false` → footer consulta · sin Agregar/carrito · restaura flags. |
| **E2E-18** | Impersonación SuperAdmin | [`smoke-saas.spec.ts`](./smoke-saas.spec.ts) | Verde (local) | SA → Abrir panel → handoff (popup o canje fetch) → banner solo lectura. |

### Detalle E2E-01

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | Setup | Registra/asegura tenant, `orderingEnabled` + `hasPickup`, producto `E2E Plato Smoke` |
| 2 | Comensal | `/menu` → agregar platillo → checkout PICKUP (nombre/tel) |
| 3 | Comensal | URL `/orders/{uuid}` · status **Recibido** |
| 4 | Cocina | Login owner → `/admin/dashboard/kitchen` → **Aceptar** |
| 5 | Comensal | Status pasa a **Confirmado** vía STOMP (timeout ~20s) |

### Detalle E2E-02

| Paso | Actor | Acción / assert |
|---|---|---|
| 1–3 | — | Igual que E2E-01 hasta **Recibido** |
| 4 | Cocina | Pestaña Recibidos → **Aceptar** → tracking **Confirmado** |
| 5 | Cocina | Pestaña Aceptados → **Cocinar** → tracking **Preparando** |
| 6 | Cocina | Pestaña En cocina → **Listo** → tracking **Entregado** |

### Detalle E2E-03

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | API | Libera mesa `8` si hay cuenta abierta; `POST /api/v1/admin/table-qr/sign` |
| 2 | Comensal | `/menu?m=8&t={token}` → agregar → **Confirmar pedido** (sin nombre/tel) |
| 3 | Comensal | Tracking **Recibido** |
| 4 | Cocina | **Aceptar**; ticket muestra **Mesa 8** |
| 5 | Comensal | Tracking **Confirmado** (WS) |

### Detalle E2E-04

| Paso | Actor | Acción / assert |
|---|---|---|
| 1–3 | — | PICKUP hasta **Entregado** (igual E2E-02) |
| 4 | Cocina | Pestaña Por cobrar → **Cobrar** → confirmar diálogo |
| 5 | Comensal | Tracking **Cuenta cerrada** (WS) |

### Detalle E2E-05

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | API + comensal | QR mesa → pedido IN_TABLE |
| 2 | Salón | `/admin/dashboard/orders` → **Pre-cuenta** en la cuenta |
| 3 | Modal | Visible con PRE-CUENTA + Mesa N |
| 4 | Modal | **Imprimir** (stub `window.print` + `afterprint`) sin dejar el botón trabado |

### Detalle E2E-06

| Paso | Actor | Acción / assert |
|---|---|---|
| 1–3 | Comensal | PICKUP hasta tracking **En vivo** |
| 4 | Red | CDP `setBlockedURLs(*ws-orders*)` + reload |
| 5 | Comensal | Hint **Reconectando** / **Sin conexión** / **Conectando** |
| 6 | Red | Limpia blocked URLs + reload → hint vuelve a **En vivo** |
| 7 | Cocina | **Aceptar** → tracking **Confirmado** (WS vivo otra vez) |

### Detalle E2E-07

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | Setup | Staff `E2E Mesero` / `E2E Cocina` con PIN (globalSetup) |
| 2 | Mesero | `/staff/login` → elegir → PIN → `/admin/dashboard/orders` |
| 3 | Cocina | `/staff/login` → elegir → PIN → `/admin/dashboard/kitchen` · tab Recibidos |

### Detalle E2E-08

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | Salón | Owner en `/admin/dashboard/orders` (WS table-calls conectado) |
| 2 | Comensal | Menú QR mesa → FAB **Ayuda** → **Llamar al mesero** → **Sí, avisar** |
| 3 | Salón | Región **Llamadas de mesa** · alerta Mesa N · **Llaman al mesero** |

### Detalle E2E-09

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | API + comensales | QR mesas 8 y 9 → dos pedidos IN_TABLE |
| 2 | Salón | **Unir** → principal 8 → vincular 9 → **Unir mesas** |
| 3 | Salón / cocina | Cuenta primaria **Mesa 8-9**; secundaria desaparece |

### Detalle E2E-10

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | Setup | `hasDelivery=true` (globalSetup) |
| 2 | Comensal | `/menu` → canal **A domicilio** → dirección → confirmar |
| 3 | Cocina | Ticket **A domicilio** + Dir. → **Aceptar** → tracking **Confirmado** |

### Detalle E2E-11

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | API | Crea platillo único |
| 2 | Comensal | Visible en `/menu` (`menu-product-{uuid}`) |
| 3 | Admin | Toggle **Agotado** → desaparece del menú público |
| 4 | Admin | Toggle **En menú** → vuelve |
| 5 | Admin | **Eliminar** + confirm → ausente en `/menu` |

### Detalle E2E-12

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | API | Producto + grupo **Tamaño** `minSelect=1` (Chico / Grande +$15) |
| 2 | Comensal | Agregar sin opción → `product-add-error` / elige entre |
| 3 | Comensal | Elige **Grande** → carrito subtotal = base + 15 |

### Detalle E2E-13

| Paso | Actor | Acción / assert |
|---|---|---|
| 1 | SQL | `plan=BASIC` (restore PRO en `finally`) |
| 2 | API | Rellena hasta 30 activos · 31.º → **400** + mensaje límite |
| 3 | Admin | Banner `30/30` · **Nuevo platillo** disabled |
| 4 | Cleanup | Borra fillers `E2E Limit *` · SQL PRO+ACTIVE |

**Última corrida documentada:** 2026-08-03 — `13 passed` (P0 + P1 completo).

---

## Sugeridas (prioridad)

Checklist para ir tachando: [`E2E_CHECKLIST.md`](./E2E_CHECKLIST.md).

### P0 — Cerrar confianza operativa

| ID | Nombre | Idea | Dependencias |
|---|---|---|---|
| ~~**E2E-06**~~ | ~~WS caído / reconexión~~ | Cubierta en suite — ver Ejecutadas | — |

### P1 — Staff y canales

| ID | Nombre | Idea |
|---|---|---|
| ~~**E2E-07**~~ | ~~Login staff PIN~~ | Cubierta en suite |
| ~~**E2E-08**~~ | ~~Llamar mesero~~ | Cubierta (WAITER); BILL opcional |
| ~~**E2E-09**~~ | ~~Unir mesas~~ | Cubierta en suite |
| ~~**E2E-10**~~ | ~~Delivery~~ | Cubierta en suite |

### P1 — Catálogo y gates

| ID | Nombre | Idea |
|---|---|---|
| ~~**E2E-11**~~ | ~~ABM menú~~ | Cubierta en suite |
| ~~**E2E-12**~~ | ~~Modificadores~~ | Cubierta en suite |
| ~~**E2E-13**~~ | ~~Límite Basic~~ | Cubierta en suite |

### P2 — SaaS / calidad

| ID | Nombre | Idea |
|---|---|---|
| ~~**E2E-14**~~ | ~~Registro onboarding~~ | Cubierta en suite |
| ~~**E2E-15**~~ | ~~Cupón Pro~~ | Cubierta en suite |
| ~~**E2E-16**~~ | ~~Pedido no encontrado~~ | Cubierta en suite |
| ~~**E2E-17**~~ | ~~Menú sin ordering~~ | Cubierta en suite |
| ~~**E2E-18**~~ | ~~Impersonación SuperAdmin~~ | Cubierta en suite |

---

## Convención al añadir un smoke

1. Spec en `e2e/*.spec.ts` (un happy path por archivo al inicio).
2. Fila nueva en **Ejecutadas** con ID `E2E-XX`, fecha y resultado.
3. Mover la fila de **Sugeridas** → **Ejecutadas** (no duplicar).
4. Preferir `data-testid` estables; no acoplar a copy frágil salvo labels de negocio (`Recibido`, `Confirmado`).
5. No subir CI todavía salvo decisión explícita (fuera del arranque actual).

---

## Fuera de alcance (por ahora)

- Suite CI en GitHub Actions
- ESC/POS / impresora física real
- Pasarela de pago comensal (Mercado Pago / Clip)
- Multi-browser matrix (solo Chromium)
