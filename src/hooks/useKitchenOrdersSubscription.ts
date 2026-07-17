"use client";

/**
 * Suscripción STOMP al canal de cocina/caja del tenant.
 * Topic: `/topic/admin/{tenantSlug}/orders`
 */

import { useEffect, useRef } from "react";
import { Client, type IMessage, type IStompSocket } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { Order, OrderResponse } from "@/types/api";
import { toOrder } from "@/lib/order-mapper";
import { adminKitchenTopic, resolveOrdersWsUrl } from "@/lib/ws";

export type KitchenConnectionState =
  | "connecting"
  | "connected"
  | "disconnected";

interface UseKitchenOrdersSubscriptionOptions {
  tenantSlug: string;
  enabled?: boolean;
  onOrderEvent: (order: Order) => void;
  onConnectionChange?: (state: KitchenConnectionState) => void;
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

export function useKitchenOrdersSubscription({
  tenantSlug,
  enabled = true,
  onOrderEvent,
  onConnectionChange,
}: UseKitchenOrdersSubscriptionOptions): void {
  const onOrderEventRef = useRef(onOrderEvent);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onOrderEventRef.current = onOrderEvent;
  onConnectionChangeRef.current = onConnectionChange;

  useEffect(() => {
    if (!enabled || !tenantSlug) return;

    if (typeof globalThis !== "undefined" && !("global" in globalThis)) {
      (globalThis as typeof globalThis & { global: typeof globalThis }).global =
        globalThis;
    }

    let client: Client;
    try {
      const sockJsUrl = resolveOrdersWsUrl();
      client = new Client({
        webSocketFactory: () => new SockJS(sockJsUrl) as unknown as IStompSocket,
        reconnectDelay: 3000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        connectionTimeout: 8000,
        onConnect: () => {
          onConnectionChangeRef.current?.("connected");
          client.subscribe(adminKitchenTopic(tenantSlug), (message) => {
            const order = parseOrderMessage(message);
            if (order) onOrderEventRef.current(order);
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
        onWebSocketError: () => {
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
  }, [tenantSlug, enabled]);
}
