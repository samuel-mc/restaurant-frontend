"use client";

import { useEffect, useRef } from "react";
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { adminAlertsTopic, resolveOrdersWsUrl } from "@/lib/ws";
import { fetchWsTicket } from "@/hooks/useKitchenOrdersSubscription";
import { playCriticalAlertSound } from "@/lib/sound-alert";
import type { CriticalFeedbackAlertEvent } from "@/types/api";

interface UseAdminAlertsSubscriptionOptions {
  tenantSlug: string;
  onCriticalAlert: (event: CriticalFeedbackAlertEvent) => void;
  enabled?: boolean;
}

export function useAdminAlertsSubscription({
  tenantSlug,
  onCriticalAlert,
  enabled = true,
}: UseAdminAlertsSubscriptionOptions) {
  const onAlertRef = useRef(onCriticalAlert);
  onAlertRef.current = onCriticalAlert;

  useEffect(() => {
    if (!enabled || !tenantSlug?.trim()) return;

    let stompClient: Client | null = null;
    let isCancelled = false;

    async function connect() {
      try {
        const ticket = await fetchWsTicket(tenantSlug);
        if (isCancelled) return;

        const topic = adminAlertsTopic(tenantSlug);
        const wsUrl = resolveOrdersWsUrl();

        stompClient = new Client({
          webSocketFactory: () => new SockJS(wsUrl),
          connectHeaders: ticket ? { Authorization: `Bearer ${ticket}` } : {},
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          onConnect: () => {
            if (isCancelled || !stompClient) return;
            stompClient.subscribe(topic, (message: IMessage) => {
              try {
                const data = JSON.parse(message.body) as CriticalFeedbackAlertEvent;
                if (data && data.type === "CRITICAL_FEEDBACK_ALERT") {
                  playCriticalAlertSound();
                  onAlertRef.current(data);
                }
              } catch {
                // Silencioso ante frames no válidos
              }
            });
          },
          onStompError: () => {
            // Reintento automático manejado por la librería
          },
        });

        stompClient.activate();
      } catch {
        // Silencioso: la vista continuará funcionando por polling o reintentos
      }
    }

    void connect();

    return () => {
      isCancelled = true;
      if (stompClient?.active) {
        void stompClient.deactivate();
      }
    };
  }, [enabled, tenantSlug]);
}
