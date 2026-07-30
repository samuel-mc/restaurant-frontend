"use client";

/**
 * Suscripción STOMP al canal de cocina/caja del tenant.
 * Topic: `/topic/admin/{tenantSlug}/orders`
 * Opcional: `/topic/admin/{tenantSlug}/table-calls` (llamar mesero / pedir cuenta).
 *
 * Requiere ticket WS de corta vida (vía `/api/admin/ws-token`) en cada CONNECT.
 * Reconexión con backoff exponencial para redes de restaurante inestables.
 */

import { useEffect, useRef } from "react";
import { Client, type IMessage, type IStompSocket } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { Order, OrderResponse, TableCallResponse } from "@/types/api";
import { toOrder } from "@/lib/order-mapper";
import {
  adminKitchenTopic,
  adminTableCallsTopic,
  resolveOrdersWsUrl,
} from "@/lib/ws";

export type KitchenConnectionState =
  | "connecting"
  | "connected"
  | "disconnected";

interface UseKitchenOrdersSubscriptionOptions {
  tenantSlug: string;
  enabled?: boolean;
  onOrderEvent: (order: Order) => void;
  /** Si se pasa, también se suscribe a TABLE_CALL en la misma conexión. */
  onTableCall?: (call: TableCallResponse) => void;
  onConnectionChange?: (state: KitchenConnectionState) => void;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const WS_TICKET_PATH = "/api/admin/ws-token";

function parseOrderMessage(message: IMessage): Order | null {
  try {
    const raw = JSON.parse(message.body) as OrderResponse;
    if (!raw?.uuid || !raw?.status) return null;
    return toOrder(raw);
  } catch {
    return null;
  }
}

function parseTableCallMessage(message: IMessage): TableCallResponse | null {
  try {
    const raw = JSON.parse(message.body) as Partial<TableCallResponse>;
    if (!raw?.id || raw.eventType !== "TABLE_CALL") return null;
    if (raw.callType !== "WAITER" && raw.callType !== "BILL") return null;
    if (typeof raw.tableNumber !== "string" || !raw.tableNumber.trim()) {
      return null;
    }
    return {
      eventType: "TABLE_CALL",
      id: String(raw.id),
      callType: raw.callType,
      tableNumber: raw.tableNumber.trim(),
      paymentMethod: raw.paymentMethod ?? null,
      note: raw.note ?? null,
      createdAt:
        typeof raw.createdAt === "string"
          ? raw.createdAt
          : new Date().toISOString(),
    };
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

async function fetchWsTicket(tenantSlug: string): Promise<string | null> {
  try {
    const response = await fetch(WS_TICKET_PATH, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "x-tenant-slug": tenantSlug.trim().toLowerCase(),
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { ticket?: unknown };
    const ticket = typeof body.ticket === "string" ? body.ticket.trim() : "";
    return ticket || null;
  } catch {
    return null;
  }
}

export function useKitchenOrdersSubscription({
  tenantSlug,
  enabled = true,
  onOrderEvent,
  onTableCall,
  onConnectionChange,
}: UseKitchenOrdersSubscriptionOptions): void {
  const onOrderEventRef = useRef(onOrderEvent);
  const onTableCallRef = useRef(onTableCall);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const subscribeTableCalls = Boolean(onTableCall);

  useEffect(() => {
    onOrderEventRef.current = onOrderEvent;
    onTableCallRef.current = onTableCall;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onOrderEvent, onTableCall, onConnectionChange]);

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
          client.reconnectDelay = nextReconnectDelay(attempt);
          const ticket = await fetchWsTicket(tenantSlug);
          if (!ticket) {
            throw new Error("No se pudo obtener ticket para WebSocket.");
          }
          client.connectHeaders = {
            Authorization: `Bearer ${ticket}`,
          };
        },
        onConnect: () => {
          attempt = 0;
          client.reconnectDelay = RECONNECT_BASE_MS;
          onConnectionChangeRef.current?.("connected");
          client.subscribe(adminKitchenTopic(tenantSlug), (message) => {
            const order = parseOrderMessage(message);
            if (order) onOrderEventRef.current(order);
          });
          if (subscribeTableCalls) {
            client.subscribe(adminTableCallsTopic(tenantSlug), (message) => {
              const call = parseTableCallMessage(message);
              if (call) onTableCallRef.current?.(call);
            });
          }
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
  }, [tenantSlug, enabled, subscribeTableCalls]);
}
