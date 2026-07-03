import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../constants/config";

const WS_URL = API_URL.replace("https://", "wss://").replace("http://", "ws://").replace("/api/v1", "");

export function useWebSocket(onMessage) {
  const { token } = useAuth();
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub;
      const url = `${WS_URL}/api/v1/ws/chat?user_id=${userId}`;
      ws.current = new WebSocket(url);

      ws.current.onopen = () => console.log("WS connecte");

      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onMessage) onMessage(data);
        } catch {}
      };

      ws.current.onclose = () => {
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.current.onerror = () => {};
    } catch (e) {
      console.log("WS erreur:", e.message);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  return ws;
}
