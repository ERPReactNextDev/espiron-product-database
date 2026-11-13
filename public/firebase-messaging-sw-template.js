importScripts("https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "%NEXT_PUBLIC_FIREBASE_API_KEY%",
  authDomain: "%NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN%",
  projectId: "%NEXT_PUBLIC_FIREBASE_PROJECT_ID%",
  storageBucket: "%NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET%",
  messagingSenderId: "%NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID%",
  appId: "%NEXT_PUBLIC_FIREBASE_APP_ID%",
  measurementId: "%NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID%",
};

const hasFirebaseConfig =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.authDomain &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.messagingSenderId &&
  !!firebaseConfig.appId;

let messaging = null;

if (hasFirebaseConfig) {
  try {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
  } catch (error) {
    console.error("Firebase init failed in service worker:", error);
  }
} else {
  console.warn("Firebase config missing in service worker. FCM will not work.");
}

function parseActions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseBoolean(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return false;
}

self.addEventListener("push", (event) => {
  console.log("📨 Push event received:", event);
  
  const payload = event.data?.json();
  console.log("📦 Push payload:", payload);
  
  if (!payload) {
    console.log("❌ No payload in push event");
    return;
  }

  const options = {
    body: payload.notification?.body || "",
    icon: payload.notification?.icon || "/favicon.ico",
    badge: payload.notification?.badge || "/favicon.ico",
    tag: payload.data?.tag || "default",
    requireInteraction: parseBoolean(payload.data?.requireInteraction),
    data: payload.data || {},
    actions: parseActions(payload.data?.actions),
    silent: false,
  };

  console.log("🔔 Showing notification:", payload.notification?.title || "Notification");
  
  event.waitUntil(
    self.registration.showNotification(payload.notification?.title || "Notification", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === "view" || !action) {
    if (data.url) {
      event.waitUntil(
        clients.openWindow(data.url)
      );
    }
  } else if (action === "edit") {
    if (data.url) {
      event.waitUntil(
        clients.openWindow(data.url)
      );
    }
  }
});

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || "Background Message";
    const notificationOptions = {
      body: payload.notification?.body,
      icon: payload.notification?.icon || "/favicon.ico",
      badge: payload.notification?.badge || "/favicon.ico",
      tag: payload.data?.tag || "default",
      requireInteraction: parseBoolean(payload.data?.requireInteraction),
      data: payload.data || {},
      actions: parseActions(payload.data?.actions),
      silent: false,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
