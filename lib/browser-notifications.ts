import { NotificationPayload } from "@/types/notifications";

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return Promise.reject("This browser does not support notifications");
  }

  if (Notification.permission === "granted") {
    return Promise.resolve("granted");
  }

  return Notification.requestPermission();
}

export function showBrowserNotification(payload: NotificationPayload): Notification | null {
  console.log("🔔 showBrowserNotification called:", payload);
  console.log("🔍 Current notification permission:", Notification.permission);
  
  if (!("Notification" in window)) {
    console.log("❌ Notification not supported");
    return null;
  }
  
  if (Notification.permission !== "granted") {
    console.log("❌ Notification permission not granted:", Notification.permission);
    console.log("⚠️ Please grant notification permission in browser settings");
    return null;
  }

  console.log("✅ Creating notification with payload:", payload);

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || payload.type,
    requireInteraction: payload.requireInteraction || false,
    data: payload.data || {},
  };

  console.log("🎯 Notification options:", options);

  const notification = new Notification(payload.title, options);
  console.log("🎉 Notification created successfully!");

  if (options.requireInteraction === false) {
    setTimeout(() => {
      console.log("⏰ Auto-closing notification after 10 seconds");
      notification.close();
    }, 10000);
  }

  notification.onclick = (event: Event) => {
    event.preventDefault();
    if (payload.data?.url) {
      window.open(payload.data.url, "_blank");
    }
    notification.close();
  };

  return notification;
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

export function vibrateDevice(pattern: number | number[] = 200): void {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function playNotificationSound(soundUrl: string = "/musics/notif-sound.mp3"): void {
  // Sound disabled by default globally
  return;
}

export function closeNotificationsByTag(tag: string): void {
  if (!("Notification" in window)) return;
  
  const notifications = document.getElementsByClassName(tag);
  Array.from(notifications).forEach((notification) => {
    (notification as any).close();
  });
}
