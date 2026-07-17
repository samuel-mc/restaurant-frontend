/**
 * Utilidades para la conexión STOMP/WebSocket con el backend.
 */

/** Convierte la URL HTTP del API en el endpoint WebSocket STOMP. */
export function resolveOrdersWsUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error(
      "Falta NEXT_PUBLIC_API_URL para abrir la conexión en tiempo real.",
    );
  }

  const normalized = baseUrl.replace(/\/+$/, "");
  const wsBase = normalized
    .replace(/^https:/i, "wss:")
    .replace(/^http:/i, "ws:");

  return `${wsBase}/ws-orders`;
}

/** Canal STOMP de tracking por pedido (espejo de cocina para el comensal). */
export function orderTrackingTopic(orderUuid: string): string {
  return `/topic/order/${orderUuid}`;
}
