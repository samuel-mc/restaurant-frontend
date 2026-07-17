/**
 * Utilidades para la conexión STOMP/SockJS con el backend.
 *
 * SockJS requiere una URL HTTP(S) (no `ws://`). Ejemplo:
 * `NEXT_PUBLIC_WS_URL=http://localhost:8080/ws-orders`
 */

/** Resuelve la URL del endpoint SockJS `/ws-orders`. */
export function resolveOrdersWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  // Fallback: deriva desde la API REST si aún no se definió WS_URL.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    throw new Error(
      "Falta NEXT_PUBLIC_WS_URL (o NEXT_PUBLIC_API_URL) para la conexión en tiempo real.",
    );
  }

  const httpBase = apiUrl
    .replace(/\/+$/, "")
    .replace(/^ws:/i, "http:")
    .replace(/^wss:/i, "https:");

  return `${httpBase}/ws-orders`;
}

/** Canal STOMP exclusivo de tracking por pedido. */
export function orderTrackingTopic(orderUuid: string): string {
  return `/topic/order/${orderUuid}`;
}

/** Canal STOMP del monitor de cocina/caja por slug de tenant. */
export function adminKitchenTopic(tenantSlug: string): string {
  return `/topic/admin/${tenantSlug}/orders`;
}
