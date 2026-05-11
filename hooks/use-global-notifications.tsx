"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { showBrowserNotification, vibrateDevice, playNotificationSound } from "@/lib/browser-notifications";
import { useNotificationSettings } from "@/hooks/use-notification-settings";

interface GlobalNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  createdAt: any;
  isActive: boolean;
  broadcastToAll: boolean;
  read?: boolean;
}

export function useGlobalNotifications() {
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const { settings } = useNotificationSettings();

  useEffect(() => {
    // Listen to global notifications from Firebase
    const q = query(
      collection(db, "global_notifications"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const notification = {
            id: change.doc.id,
            ...change.doc.data(),
          } as GlobalNotification;

          // Only show notification if it's active and broadcast to all
          if (notification.isActive && notification.broadcastToAll) {
            // Show browser notification for real-time updates
            showBrowserNotification({
              type: notification.type as any,
              title: notification.title,
              body: notification.body,
              icon: notification.icon,
              badge: notification.badge,
              tag: notification.tag,
              requireInteraction: notification.requireInteraction,
              data: notification.data,
              actions: notification.actions,
            });

            // Vibrate if enabled
            if (settings?.vibrationEnabled) {
              vibrateDevice();
            }

            // Play sound if enabled
            if (settings?.soundEnabled) {
              playNotificationSound();
            }
          }

          // Add to local state
          setNotifications((prev) => {
            const exists = prev.find((n) => n.id === notification.id);
            if (!exists) {
              return [notification, ...prev].slice(0, 100); // Keep only last 100
            }
            return prev;
          });
        }
      });
    });

    return () => unsubscribe();
  }, [settings]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return {
    notifications,
    clearNotifications,
    markAsRead,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}
