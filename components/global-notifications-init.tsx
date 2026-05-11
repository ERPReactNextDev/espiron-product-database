"use client";

import { useGlobalNotifications } from "@/hooks/use-global-notifications";

export function GlobalNotificationsInit() {
  // Initialize global notifications for all users
  useGlobalNotifications();
  
  return null; // This component doesn't render anything
}
