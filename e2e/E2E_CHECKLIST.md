# Checklist E2E sugeridas

Marca las pruebas conforme se automaticen o se validen a mano. Detalle y contexto: [`E2E_TESTS.md`](./E2E_TESTS.md).

Leyenda: `[x]` hecha · `[ ]` pendiente

---

## Ya en suite (referencia)

- [x] **E2E-01** — Loop operativo PICKUP (menú → pedido → cocina Aceptar → tracking WS)

---

## P0 — Confianza operativa

- [x] **E2E-02** — Loop completo hasta Entregado (Cocinar → Listo → tracking Preparando / Entregado)
- [x] **E2E-03** — Pedido IN_TABLE con QR (`tableToken` → menú mesa → cocina)
- [x] **E2E-04** — Cobrar y cerrar (DELIVERED → Cobrar → cuenta cerrada / mesa libre)
- [x] **E2E-05** — Pre-cuenta / ticket (modal desde salón → Imprimir sin crash)
- [x] **E2E-06** — WS caído / reconexión (UI degrada → recupera)

## P1 — Staff y canales

- [x] **E2E-07** — Login staff PIN (MESERO / COCINA → pantalla correcta)
- [x] **E2E-08** — Llamar mesero / pedir cuenta (FAB → alerta salón)
- [x] **E2E-09** — Unir mesas (merge → label / ticket con mesas unidas)
- [x] **E2E-10** — Delivery (dirección → cocina)

## P1 — Catálogo y gates

- [x] **E2E-11** — ABM menú (crear / toggle / borrar → reflejo en `/menu`)
- [x] **E2E-12** — Modificadores (obligatorio + subtotal)
- [x] **E2E-13** — Límite Basic (31.º platillo rechazado)

## P2 — SaaS / calidad

- [x] **E2E-14** — Registro onboarding (landing → slug → login admin)
- [x] **E2E-15** — Cupón Pro (redeem → ACTIVE → pickup)
- [x] **E2E-16** — Pedido no encontrado (UUID inválido → empty/error)
- [x] **E2E-17** — Menú sin ordering (`orderingEnabled=false` → sin Agregar)
- [x] **E2E-18** — Impersonación SuperAdmin (handoff read-only)

---

## Al completar una

1. Marca `[x]` aquí.
2. Añade fila en **Ejecutadas** de [`E2E_TESTS.md`](./E2E_TESTS.md) (spec, fecha, resultado).
3. Si era solo manual, anota “manual” en Notas hasta que exista `*.spec.ts`.
