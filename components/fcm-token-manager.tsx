"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "@/lib/firebase";
import { useUser } from "@/contexts/UserContext";
import { vibrateDevice } from "@/lib/browser-notifications";
import type { NotificationSettings } from "@/types/notifications";

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  productNotifications: true,
  supplierNotifications: true,
  spfNotifications: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoClose: true,
  autoCloseDuration: 5000,
};

export function FCMTokenManager() {
  const { userId, loading } = useUser();
  const [deviceSettings, setDeviceSettings] = useState(DEFAULT_SETTINGS);
  const [deviceSettingsLoaded, setDeviceSettingsLoaded] = useState(false);

  const refreshDeviceSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem("notificationSettings");
      setDeviceSettings(saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS);
    } catch (error) {
      console.error("Failed to load notification settings for push:", error);
    } finally {
      setDeviceSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshDeviceSettings();
    window.addEventListener("notification-settings-updated", refreshDeviceSettings);
    window.addEventListener("storage", refreshDeviceSettings);

    return () => {
      window.removeEventListener("notification-settings-updated", refreshDeviceSettings);
      window.removeEventListener("storage", refreshDeviceSettings);
    };
  }, [refreshDeviceSettings]);

  useEffect(() => {
    if (loading || !deviceSettingsLoaded || !userId) return;

    const registerFCMToken = async () => {
      try {
        if (!messaging || !("serviceWorker" in navigator) || !("Notification" in window)) return;

        let permission = Notification.permission;
        if (permission === "default" && deviceSettings.enabled) {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_KEY;
        if (!vapidKey) {
          throw new Error("VAPID key is missing");
        }

        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
        if (!token) {
          throw new Error("Firebase did not return an FCM registration token");
        }

        const response = await fetch("/api/notifications/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
            notificationSettings: deviceSettings,
          }),
        });

        if (!response.ok) {
          throw new Error(`Token registration failed (${response.status}): ${await response.text()}`);
        }
      } catch (error) {
        console.error("FCM registration error:", error);
      }
    };

    void registerFCMToken();
  }, [deviceSettings, deviceSettingsLoaded, loading, userId]);

  useEffect(() => {
    if (!messaging || !userId) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      const type = payload.data?.type || "";
      const categoryEnabled = type.startsWith("product_")
        ? deviceSettings.productNotifications
        : type.startsWith("supplier_")
          ? deviceSettings.supplierNotifications
          : type.startsWith("spf_")
            ? deviceSettings.spfNotifications
            : true;

      if (!deviceSettings.enabled || !categoryEnabled || !payload.notification?.title) return;

      new Notification(payload.notification.title, {
        body: payload.notification.body || "",
        icon: payload.notification.icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: payload.data?.tag || type || payload.notification.title,
        requireInteraction: payload.data?.requireInteraction === "true",
        data: payload.data || {},
      });

      if (deviceSettings.vibrationEnabled) vibrateDevice();
    });

    return () => unsubscribe();
  }, [deviceSettings, userId]);

  return null;
}
