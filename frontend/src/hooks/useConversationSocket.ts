import { useEffect, useRef, useCallback } from "react";
import type { Message } from "../api/messaging";

const MAX_RETRIES = 6;

/**
 * Opens a WebSocket to the conversation channel and calls `onNewMessage`
 * whenever the server pushes a new message event.
 *
 * Reconnects automatically with exponential backoff (1s → 2s → 4s … 32s).
 * Closes code 4001 (unauthenticated) and 4003 (not a participant) are
 * terminal — no reconnect attempt is made.
 *
 * The hook also sends periodic pings so the connection is not dropped by
 * load balancers or proxies with short idle timeouts.
 */
export function useConversationSocket(
  conversationId: number,
  onNewMessage: (msg: Message) => void,
  onUnreadUpdate?: (count: number) => void
) {
  // Keep callback refs so the effect does not re-run when the callbacks change.
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  onUnreadUpdateRef.current = onUnreadUpdate;

  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function clearTimers() {
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      pingTimer = null;
      reconnectTimer = null;
    }

    function connect() {
      if (cancelled) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/messaging/conversations/${conversationId}/`;

      socket = new WebSocket(url);

      socket.onopen = () => {
        retries = 0;
        // Send keepalive ping every 25 s to prevent proxy idle-timeout drops.
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as {
            type: string;
            message?: Message;
            unread_count?: number;
          };

          if (data.type === "new_message" && data.message) {
            onNewMessageRef.current(data.message);
          } else if (data.type === "unread_update" && data.unread_count !== undefined) {
            onUnreadUpdateRef.current?.(data.unread_count);
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = (event: CloseEvent) => {
        clearTimers();

        // Terminal close codes — no point retrying.
        if (cancelled || event.code === 4001 || event.code === 4003) return;

        if (retries >= MAX_RETRIES) return;

        const delay = Math.min(1000 * 2 ** retries, 32000);
        retries += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimers();
      socket?.close();
    };
  }, [conversationId]);
}
