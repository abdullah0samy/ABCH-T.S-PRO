import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, refreshAccessToken } from '../store/authStore.ts';
import { useSettingsStore } from '../store/settingsStore.ts';
import { apiFetch } from './api.ts';

const SOCKET_URL = (import.meta.env.VITE_API_BASE as string) || window.location.origin;


interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: Date;
  read: boolean;
  link?: string;
  ticketId?: number;
  status?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  toasts: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeToast: (id: string) => void;
  addNotification: (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;
const TOAST_DURATION = 6000;
const MAX_NOTIFICATIONS = 100;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, accessToken } = useAuthStore();
  const { language } = useSettingsStore();
  const langRef = useRef(language);
  langRef.current = language;

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const currentLang = langRef.current;
    const newNotif: Notification = {
      ...notif,
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      createdAt: new Date(),
      read: false
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      return updated.length > MAX_NOTIFICATIONS ? updated.slice(0, MAX_NOTIFICATIONS) : updated;
    });
    setToasts(prev => [...prev, newNotif]);

    const timer = setTimeout(() => {
      toastTimersRef.current.delete(newNotif.id);
      setToasts(prev => prev.filter(t => t.id !== newNotif.id));
    }, TOAST_DURATION);
    toastTimersRef.current.set(newNotif.id, timer);

    if (typeof window.Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(newNotif.title, { body: newNotif.message });
    }
  }, []);

  const connectSocket = useCallback(() => {
    const currentToken = useAuthStore.getState().accessToken;
    const currentUser = useAuthStore.getState().user;
    if (!currentToken || !currentUser) return;

    if (socketRef.current?.connected) return;

    socketRef.current?.disconnect();
    socketRef.current?.removeAllListeners();

    const newSocket = io(SOCKET_URL, {
      auth: { token: currentToken },
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      reconnectAttemptsRef.current = 0;
      newSocket.emit('join-user', currentUser.id);
      if (currentUser.departmentId) {
        newSocket.emit('join-department', currentUser.departmentId);
      }
    });

    newSocket.on('disconnect', () => {
    });

    newSocket.on('connect_error', async (err) => {
      reconnectAttemptsRef.current++;
      if (err?.message?.includes('Invalid or expired token') && reconnectAttemptsRef.current <= 2) {
        const freshToken = await refreshAccessToken();
        if (freshToken && socketRef.current) {
          socketRef.current.auth = { token: freshToken };
          socketRef.current.connect();
        }
      }
    });

    newSocket.on('new-ticket', (data: any) => {
      window.dispatchEvent(new CustomEvent('ws:ticket-created', { detail: data }));
      addNotification({
        title: langRef.current === 'ar' ? 'تذكرة جديدة' : 'New Ticket',
        message: `${data.ticketNumber}: ${data.subject}`,
        type: 'info',
        link: `/tickets/${data.id}`
      });
    });

    newSocket.on('ticket-status-updated', (data: any) => {
      window.dispatchEvent(new CustomEvent('ws:ticket-status-updated', { detail: data }));
      const isResolved = data.status === 'resolved';
      addNotification({
        title: langRef.current === 'ar' ? 'تحديث حالة التذكرة' : 'Ticket Status Updated',
        message: `${data.ticketNumber} is now ${data.status}`,
        type: 'success',
        link: `/tickets/${data.id}${isResolved ? '?confirm=true' : ''}`,
        ticketId: data.id,
        status: data.status
      });
    });

    newSocket.on('ticket-assigned', (data: any) => {
      window.dispatchEvent(new CustomEvent('ws:ticket-assigned', { detail: data }));
      addNotification({
        title: langRef.current === 'ar' ? 'تم تعيين تذكرة لك' : 'Ticket Assigned to You',
        message: `${data.ticketNumber}: ${data.subject}`,
        type: 'warning',
        link: `/tickets/${data.id}`
      });
    });

    newSocket.on('new-comment', (data: any) => {
      window.dispatchEvent(new CustomEvent('ws:new-comment', { detail: data }));
      addNotification({
        title: langRef.current === 'ar' ? 'تعليق جديد' : 'New Comment',
        message: `${data.ticketNumber}: ${data.message.body?.substring(0, 50)}${data.message.body?.length > 50 ? '...' : ''}`,
        type: 'info',
        link: `/tickets/${data.ticketId}`
      });
    });

    newSocket.on('sla-warning', (data: any) => {
      addNotification({
        title: langRef.current === 'ar' ? 'تنبيه SLA' : 'SLA Warning',
        message: `${data.ticketNumber}: ${data.percentage}% of SLA time consumed!`,
        type: 'warning',
        link: `/tickets/${data.id}`
      });
    });

    newSocket.on('ticket-closed', (data: any) => {
      window.dispatchEvent(new CustomEvent('ws:ticket-status-updated', { detail: data }));
      addNotification({
        title: langRef.current === 'ar' ? 'تم إغلاق التذكرة' : 'Ticket Closed',
        message: `${data.ticketNumber} has been confirmed and closed.`,
        type: 'success',
        link: `/tickets/${data.id}`,
        ticketId: data.id,
        status: 'closed',
      });
    });

    newSocket.on('sla-breach', (data: any) => {
      addNotification({
        title: langRef.current === 'ar' ? 'خرق SLA' : 'SLA Breach',
        message: `${data.ticketNumber}: SLA has been breached!`,
        type: 'error',
        link: `/tickets/${data.id}`
      });
    });

    socketRef.current = newSocket;
  }, [addNotification]);

  useEffect(() => {
    if (accessToken && user) {
      connectSocket();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [accessToken, user?.id, user?.departmentId, connectSocket]);

  useEffect(() => {
    if (!accessToken || !user) return;
    let cancelled = false;
    apiFetch('/api/notifications?limit=30')
      .then((res) => {
        if (cancelled || !res?.data) return;
        const dbNotifs: Notification[] = res.data.map((n: any) => ({
          id: String(n.id),
          title: (language === 'ar' ? (n.titleAr || n.titleEn) : (n.titleEn || n.titleAr)) || (language === 'ar' ? 'تنبيه' : 'Notification'),
          message: (language === 'ar' ? (n.bodyAr || n.bodyEn) : (n.bodyEn || n.bodyAr)) || '',
          type: 'info',
          createdAt: new Date(n.createdAt),
          read: Boolean(n.isRead),
          link: n.ticketId ? `/tickets/${n.ticketId}` : undefined,
          ticketId: n.ticketId ?? undefined,
        }));
        setNotifications((prev) => {
          const existingIds = new Set(dbNotifs.map((d) => d.id));
          const merged = [...prev.filter((p) => !existingIds.has(p.id) && !/^\d+$/.test(p.id)), ...dbNotifs];
          return merged.slice(0, MAX_NOTIFICATIONS);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, user?.id, language]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window.Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (/^\d+$/.test(id)) {
      apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    apiFetch('/api/notifications/read-all', { method: 'PUT' }).catch(() => {});
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      toasts,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      removeToast,
      addNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Notifications are a side-channel: toasts and a bell badge. A page that can
 * otherwise do its job should not be destroyed because that channel is
 * unavailable — throwing here took the whole Team Feed down and showed an
 * error screen instead of the notes, even though the feed itself was fine.
 *
 * The missing provider is still surfaced loudly in development so the wiring
 * bug gets fixed rather than silently tolerated.
 */
const noopNotifications: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  toasts: [],
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  removeToast: () => {},
  addNotification: () => {},
};

let warnedAboutMissingProvider = false;

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    if (import.meta.env.DEV && !warnedAboutMissingProvider) {
      warnedAboutMissingProvider = true;
      console.error(
        '[NotificationProvider] useNotifications was called outside a provider; ' +
          'notifications are disabled for this subtree.',
      );
    }
    return noopNotifications;
  }
  return context;
};
