"use client";

/**
 * Suscripción STOMP al canal de cocina/caja del tenant.
 * Topic: `/topic/admin/{tenantSlug}/orders`
 *
 * Reconexión con backoff exponencial para redes de restaurante inestables.
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

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function parseOrderMessage(message: IMessage): Order | null {
  try {
    const raw = JSON.parse(message.body) as OrderResponse;
    if (!raw?.uuid || !raw?.status) return null;
    return toOrder(raw);
  } catch {
    return null;
  }
}

function nextReconnectDelay(attempt: number): number {
  const exp = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * 2 ** Math.max(0, attempt),
  );
  // Jitter ±20% para evitar thundering herd si varias tablets reconectan.
  const jitter = exp * (0.8 + Math.random() * 0.4);
  return Math.round(Math.min(RECONNECT_MAX_MS, jitter));
}

export function useKitchenOrdersSubscription({
  tenantSlug,
  enabled = true,
  onOrderEvent,
  onConnectionChange,
}: UseKitchenOrdersSubscriptionOptions): void {
  const onOrderEventRef = useRef(onOrderEvent);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onOrderEventRef.current = onOrderEvent;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onOrderEvent, onConnectionChange]);

  useEffect(() => {
    if (!enabled || !tenantSlug) return;

    if (typeof globalThis !== "undefined" && !("global" in globalThis)) {
      (globalThis as typeof globalThis & { global: typeof globalThis }).global =
        globalThis;
    }

    let attempt = 0;
    let client: Client;

    try {
      const sockJsUrl = resolveOrdersWsUrl();
      client = new Client({
        webSocketFactory: () => new SockJS(sockJsUrl) as unknown as IStompSocket,
        // stompjs llama esta función en cada intento de reconexión.
        reconnectDelay: RECONNECT_BASE_MS,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        connectionTimeout: 8_000,
        beforeConnect: async () => {
          // Ajusta el delay del próximo ciclo con backoff exponencial.
          client.reconnectDelay = nextReconnectDelay(attempt);
        },
        onConnect: () => {
          attempt = 0;
          client.reconnectDelay = RECONNECT_BASE_MS;
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
          attempt += 1;
          onConnectionChangeRef.current?.("disconnected");
        },
        onWebSocketClose: () => {
          attempt += 1;
          onConnectionChangeRef.current?.("disconnected");
        },
        onWebSocketError: () => {
          attempt += 1;
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
