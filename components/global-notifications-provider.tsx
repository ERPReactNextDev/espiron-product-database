"use client";

import React, { useEffect } from "react";
import { useGlobalNotifications } from "@/hooks/use-global-notifications";

interface GlobalNotificationsProviderProps {
  children: React.ReactNode;
}

export function GlobalNotificationsProvider({ children }: GlobalNotificationsProviderProps) {
  // Initialize global notifications listener
  const { notifications } = useGlobalNotifications();

  useEffect(() => {
    // The hook handles all the notification logic
    // This provider just ensures hook is initialized at app root
    console.log("Global notifications initialized:", notifications.length);
  }, [notifications]);

  return <>{children}</>;
}
