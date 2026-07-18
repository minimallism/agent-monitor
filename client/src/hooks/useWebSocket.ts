import { useEffect, useRef, useCallback, useState } from "react";
import type { WSMessage } from "../lib/types";
import { eventBus } from "../lib/eventBus";
import { dashboardToken } from "../lib/api";

type MessageHandler = (msg: WSMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<MessageHandler>(onMessage);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  handlersRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    
    
    
    
    
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    
    
    const token = dashboardToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const ws = new WebSocket(`${protocol}//${host}/ws${query}`);

    ws.onopen = () => {
      if (mountedRef.current) {
        setConnected(true);
        eventBus.setConnected(true);
        reconnectAttempts.current = 0; 
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        handlersRef.current(msg);
      } catch {
        
      }
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        setConnected(false);
        eventBus.setConnected(false);
        
        
        
        
        const delay = Math.min(500 * Math.pow(2, reconnectAttempts.current), 3000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) {
        
        
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  
  
  
  
  
  useEffect(() => {
    const reconnectNow = () => {
      if (!mountedRef.current) return;
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return; 
      }
      clearTimeout(reconnectTimer.current);
      reconnectAttempts.current = 0;
      connect();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") reconnectNow();
    };
    window.addEventListener("focus", reconnectNow);
    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", reconnectNow);
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [connect]);

  return { connected };
}
