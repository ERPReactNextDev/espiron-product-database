"use client";

import { useState, useEffect, useCallback } from "react";
import { NotificationSettings } from "@/types/notifications";

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

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedSettings = localStorage.getItem("notificationSettings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error("Failed to parse notification settings:", error);
      }
    }
    setIsLoading(false);
  }, []);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    localStorage.setItem("notificationSettings", JSON.stringify(newSettings));
    window.dispatchEvent(new Event("notification-settings-updated"));
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem("notificationSettings", JSON.stringify(DEFAULT_SETTINGS));
    window.dispatchEvent(new Event("notification-settings-updated"));
  }, []);

  const toggleEnabled = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  const toggleProductNotifications = useCallback(() => {
    updateSettings({ productNotifications: !settings.productNotifications });
  }, [settings.productNotifications, updateSettings]);

  const toggleSupplierNotifications = useCallback(() => {
    updateSettings({ supplierNotifications: !settings.supplierNotifications });
  }, [settings.supplierNotifications, updateSettings]);

  const toggleSPFNotifications = useCallback(() => {
    updateSettings({ spfNotifications: !settings.spfNotifications });
  }, [settings.spfNotifications, updateSettings]);

  const toggleSoundEnabled = useCallback(() => {
    updateSettings({ soundEnabled: !settings.soundEnabled });
  }, [settings.soundEnabled, updateSettings]);

  const toggleVibrationEnabled = useCallback(() => {
    updateSettings({ vibrationEnabled: !settings.vibrationEnabled });
  }, [settings.vibrationEnabled, updateSettings]);

  const toggleAutoClose = useCallback(() => {
    updateSettings({ autoClose: !settings.autoClose });
  }, [settings.autoClose, updateSettings]);

  const setAutoCloseDuration = useCallback((duration: number) => {
    updateSettings({ autoCloseDuration: duration });
  }, [updateSettings]);

  return {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
    toggleEnabled,
    toggleProductNotifications,
    toggleSupplierNotifications,
    toggleSPFNotifications,
    toggleSoundEnabled,
    toggleVibrationEnabled,
    toggleAutoClose,
    setAutoCloseDuration,
  };
}
