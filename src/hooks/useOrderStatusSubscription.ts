"use client";

/**
 * Suscripción STOMP al canal de un pedido.
 *
 * Conecta a `/ws-orders`, escucha `/topic/order/{uuid}` y reconecta con
 * backoff ante caídas de red. Solo corre en el navegador.
 */

import { useEffect, useRef } from "react";
import { Client, type IMessage } from "@stomp/stompjs";
import type { Order, OrderResponse } from "@/types/api";
import { formatCurrency } from "@/lib/format";
import { orderTrackingTopic, resolveOrdersWsUrl } from "@/lib/ws";

function toOrder(dto: OrderResponse): Order {
  return {
    uuid: dto.uuid,
    customerName: dto.customerName,
    customerPhone: dto.customerPhone ?? null,
    orderType: dto.orderType,
    tableNumber: dto.tableNumber ?? null,
    deliveryAddress: dto.deliveryAddress ?? null,
    status: dto.status,
    totalAmount: dto.totalAmount,
    formattedTotal: formatCurrency(dto.totalAmount),
    createdAt: dto.createdAt,
    items: (dto.details ?? []).map((detail) => ({
      productUuid: detail.productUuid,
      productName: detail.productName,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      subtotal: detail.subtotal,
      formattedSubtotal: formatCurrency(detail.subtotal),
      notes: detail.notes ?? null,
    })),
  };
}

function parseOrderMessage(message: IMessage): Order | null {
  try {
    const raw = JSON.parse(message.body) as OrderResponse;
    if (!raw?.uuid || !raw?.status) return null;
    return toOrder(raw);
  } catch {
    return null;
  }
}

export type OrderConnectionState =
  | "connecting"
  | "connected"
  | "disconnected";

interface UseOrderStatusSubscriptionOptions {
  orderUuid: string;
  enabled?: boolean;
  onUpdate: (order: Order) => void;
  onConnectionChange?: (state: OrderConnectionState) => void;
}

/**
 * Mantiene una suscripción en vivo al estado del pedido.
 */
export function useOrderStatusSubscription({
  orderUuid,
  enabled = true,
  onUpdate,
  onConnectionChange,
}: UseOrderStatusSubscriptionOptions): void {
  const onUpdateRef = useRef(onUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onUpdateRef.current = onUpdate;
  onConnectionChangeRef.current = onConnectionChange;

  useEffect(() => {
    if (!enabled || !orderUuid) return;

    // @stomp/stompjs espera `global` en algunos empaquetados del browser.
    if (typeof globalThis !== "undefined" && !("global" in globalThis)) {
      (globalThis as typeof globalThis & { global: typeof globalThis }).global =
        globalThis;
    }

    let client: Client;
    try {
      const brokerURL = resolveOrdersWsUrl();
      client = new Client({
        brokerURL,
        reconnectDelay: 3000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          onConnectionChangeRef.current?.("connected");
          client.subscribe(orderTrackingTopic(orderUuid), (message) => {
            const order = parseOrderMessage(message);
            if (order) onUpdateRef.current(order);
          });
        },
        onDisconnect: () => {
          onConnectionChangeRef.current?.("disconnected");
        },
        onStompError: () => {
          onConnectionChangeRef.current?.("disconnected");
        },
        onWebSocketClose: () => {
          onConnectionChangeRef.current?.("disconnected");
        },
      });
    } catch {
      onConnectionChangeRef.current?.("disconnected");
      return;
    }

    onConnectionChangeRef.current?.("connecting");
    client.activate();

    return () => {
      void client.deactivate();
    };
  }, [orderUuid, enabled]);
}
