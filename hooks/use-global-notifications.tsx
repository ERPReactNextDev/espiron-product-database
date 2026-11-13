"use client";

import { useEffect, useRef, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { showBrowserNotification, vibrateDevice, playNotificationSound } from "@/lib/browser-notifications";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { useUser } from "@/contexts/UserContext";
import type { NotificationPayload, NotificationType } from "@/types/notifications";

interface GlobalNotification extends NotificationPayload {
  id: string;
  createdAt?: unknown;
  isActive: boolean;
  broadcastToAll: boolean;
  read?: boolean;
}

const SEEN_NOTIFICATIONS_KEY = "seenGlobalNotificationIds";
const MAX_STORED_SEEN_NOTIFICATIONS = 500;

function readSeenNotificationIds(): Set<string> {
  try {
    const stored = localStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    const ids: unknown = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch (error) {
    console.error("Failed to load seen notification IDs:", error);
    return new Set();
  }
}

function persistSeenNotificationIds(ids: Set<string>): void {
  try {
    localStorage.setItem(
      SEEN_NOTIFICATIONS_KEY,
      JSON.stringify([...ids].slice(-MAX_STORED_SEEN_NOTIFICATIONS))
    );
  } catch (error) {
    console.error("Failed to save seen notification IDs:", error);
  }
}

export function useGlobalNotifications() {
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const { settings } = useNotificationSettings();
  const { userId, loading } = useUser();
  const settingsRef = useRef(settings);
  const seenNotificationIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (loading || !userId) return;

    const seenIds = seenNotificationIdsRef.current ?? readSeenNotificationIds();
    seenNotificationIdsRef.current = seenIds;
    let isInitialSnapshot = true;

    const q = query(
      collection(db, "global_notifications"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        if (isInitialSnapshot) {
          const existingNotifications = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as GlobalNotification[];

          if (snapshot.metadata.fromCache) {
            setNotifications(existingNotifications);
            return;
          }

          isInitialSnapshot = false;
          existingNotifications.forEach((notification) => seenIds.add(notification.id));
          persistSeenNotificationIds(seenIds);
          setNotifications(existingNotifications);
          return;
        }

        const addedNotifications: GlobalNotification[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added" || seenIds.has(change.doc.id)) return;

          seenIds.add(change.doc.id);
          const notification = {
            id: change.doc.id,
            ...change.doc.data(),
          } as GlobalNotification;
          addedNotifications.push(notification);
        });

        if (addedNotifications.length === 0) return;

        persistSeenNotificationIds(seenIds);
        setNotifications((previous) => {
          const existingIds = new Set(previous.map((notification) => notification.id));
          return [
            ...addedNotifications.filter((notification) => !existingIds.has(notification.id)),
            ...previous,
          ].slice(0, 100);
        });

        const currentSettings = settingsRef.current;
        addedNotifications.forEach((notification) => {
          if (!notification.isActive || !notification.broadcastToAll || !currentSettings.enabled) return;

          const isEnabled =
            notification.type.startsWith("product_")
              ? currentSettings.productNotifications
              : notification.type.startsWith("supplier_")
                ? currentSettings.supplierNotifications
                : notification.type.startsWith("spf_")
                  ? currentSettings.spfNotifications
                  : true;

          if (!isEnabled) return;

          showBrowserNotification({
            ...notification,
            type: notification.type as NotificationType,
          });

          if (currentSettings.vibrationEnabled) vibrateDevice();
          if (currentSettings.soundEnabled) playNotificationSound();
        });
      },
      (error) => {
        console.error("Error listening for global notifications:", error);
      }
    );
  }, [userId, loading]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAsRead = (id: string) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  return {
    notifications,
    clearNotifications,
    markAsRead,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  };
}
