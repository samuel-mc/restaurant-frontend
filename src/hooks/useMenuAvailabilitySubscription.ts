"use client";

/**
 * Suscripción STOMP/WebSocket al canal público de disponibilidad del menú (/topic/{tenantSlug}/menu-updates).
 */

import { useEffect, useRef } from "react";
import { Client, type IMessage, type IStompSocket } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { menuUpdatesTopic, resolveOrdersWsUrl } from "@/lib/ws";

export interface MenuAvailabilityEvent {
  type: "PRODUCT_AVAILABILITY_CHANGED";
  productId: string;
  isAvailable: boolean;
  categoryId: string;
}

function parseMenuUpdateMessage(message: IMessage): MenuAvailabilityEvent | null {
  try {
    const raw = JSON.parse(message.body) as Partial<MenuAvailabilityEvent>;
    if (
      raw?.type === "PRODUCT_AVAILABILITY_CHANGED" &&
      typeof raw?.productId === "string" &&
      typeof raw?.isAvailable === "boolean"
    ) {
      return {
        type: "PRODUCT_AVAILABILITY_CHANGED",
        productId: raw.productId,
        isAvailable: raw.isAvailable,
        categoryId: String(raw.categoryId ?? ""),
      };
    }
    return null;
  } catch {
    return null;
  }
}

interface UseMenuAvailabilitySubscriptionOptions {
  tenantSlug: string;
  enabled?: boolean;
  onAvailabilityChange: (event: MenuAvailabilityEvent) => void;
}

/**
 * Suscribe a las actualizaciones en tiempo real de platillos agotados/disponibles del tenant.
 */
export function useMenuAvailabilitySubscription({
  tenantSlug,
  enabled = true,
  onAvailabilityChange,
}: UseMenuAvailabilitySubscriptionOptions): void {
  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  onAvailabilityChangeRef.current = onAvailabilityChange;

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
          client.subscribe(menuUpdatesTopic(tenantSlug), (message) => {
            const evt = parseMenuUpdateMessage(message);
            if (evt) {
              onAvailabilityChangeRef.current(evt);
            }
          });
        },
      });
    } catch {
      return;
    }

    client.activate();

    return () => {
      void client.deactivate();
    };
  }, [tenantSlug, enabled]);
}
