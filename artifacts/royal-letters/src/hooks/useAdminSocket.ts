import { useEffect, useRef, useCallback } from "react";

export interface WsEvent {
  type: string;
  letterId?: string;
  recipientName?: string;
  preview?: string;
  readAt?: string;
  title?: string;
  timestamp?: number;
  unread?: number;
  lastSeen?: string;
  token?: string;
  emoji?: string;
}

export function useAdminSocket(onEvent: (e: WsEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const unmountedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const wsUrl = `${proto}://${location.host}${base}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000; // reset backoff
    };

    ws.onmessage = (msg) => {
      try {
        const event: WsEvent = JSON.parse(msg.data);
        onEventRef.current(event);
      } catch {}
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      const delay = Math.min(backoffRef.current, 30_000);
      backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
      setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);
}
