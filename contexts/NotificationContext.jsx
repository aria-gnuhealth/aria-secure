import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import api from "../services/api";

const NotificationContext = createContext({
  unreadMessages: 0,
  fetchUnread: () => {},
  markAllRead: () => {},
});

export function NotificationProvider({ children }) {
  const { user, token } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (user && token) {
      fetchUnread();
      intervalRef.current = setInterval(fetchUnread, 15000);
    } else {
      setUnreadMessages(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, token]);

  const fetchUnread = async () => {
    try {
      const res = await api.get("/chat/discussions");
      const discussions = res.data?.discussions || res.data || [];
      const total = discussions.reduce((sum, d) => sum + (d.unread_count || 0), 0);
      setUnreadMessages(total);
    } catch (e) {
      // Silencieux
    }
  };

  const markAllRead = () => setUnreadMessages(0);

  return (
    <NotificationContext.Provider value={{ unreadMessages, fetchUnread, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
