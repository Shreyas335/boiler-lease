import { useEffect, useRef } from "react";
import type { AppNotification } from "../api/notifications";

const MAX_RETRIES = 6;

/**
 * Opens a WebSocket to the global notifications channel and calls
 * `onNotification` whenever the server pushes a new in-app notification.
 * Connects to ws/notifications/ which maps to NotificationConsumer.
 */
export function useNotificationSocket(
  enabled: boolean,
  onNotification: (n: AppNotification) => void
) {
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let retries = 0;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/notifications/`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        retries = 0;
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as {
            type: string;
            notification?: AppNotification;
          };
          if (data.type === "notification" && data.notification) {
            onNotificationRef.current(data.notification);
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = (event: CloseEvent) => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (cancelled || event.code === 4001) return;
        if (retries >= MAX_RETRIES) return;
        const delay = Math.min(1000 * 2 ** retries, 32000);
        retries += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled]);
}
