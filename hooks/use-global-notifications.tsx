"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db, dbLogs, dbCollab } from "@/lib/firebase";
import { showBrowserNotification, vibrateDevice, playNotificationSound } from "@/lib/browser-notifications";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { useUser } from "@/contexts/UserContext";

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
  const { userId } = useUser();

  useEffect(() => {
    // Only listen for notifications if user is logged in
    if (!userId) {
      console.log("🔒 User not logged in, skipping notification listener");
      return;
    }

    // Try all three Firebase databases to find global notifications
    const databases = [
      { name: "main", db: db },
      { name: "logs", db: dbLogs },
      { name: "collab", db: dbCollab }
    ];

    const unsubscribes = databases.map(({ name, db }) => {
      console.log(`🔍 Trying to connect to ${name} database...`);
      
      const q = query(
        collection(db, "global_notifications"),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      return onSnapshot(q, (snapshot) => {
        console.log(`🔥 ${name} notifications snapshot received:`, snapshot.size, "documents");
        
        snapshot.docChanges().forEach((change) => {
          console.log(`📝 ${name} document change:`, change.type, change.doc.id);
          
          if (change.type === "added") {
            const notification = {
              id: change.doc.id,
              ...change.doc.data(),
            } as GlobalNotification;

            console.log(`🔔 ${name} new notification:`, notification);
            console.log(`✅ ${name} isActive:`, notification.isActive, "broadcastToAll:", notification.broadcastToAll);

            // Only show notification if it's active and broadcast to all
            if (notification.isActive && notification.broadcastToAll) {
              console.log(`🚀 ${name} showing browser notification...`);
              
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
            } else {
              console.log(`❌ ${name} notification not shown - isActive:`, notification.isActive, "broadcastToAll:", notification.broadcastToAll);
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
      }, (error) => {
        console.error(`❌ Error connecting to ${name} database:`, error);
      });
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [settings, userId]);

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
