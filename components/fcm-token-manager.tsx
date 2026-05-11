"use client";

import { useEffect, useState } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db, messaging } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function FCMTokenManager() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const registerFCMToken = async () => {
      try {
        // Request notification permission first
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("❌ Notification permission denied");
          return;
        }

        // Get FCM token
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_KEY;
        
        if (!vapidKey) {
          console.error("❌ VAPID key is missing");
          return;
        }
        
        const currentToken = await getToken(messaging, { 
          vapidKey: vapidKey as string
        });

        if (currentToken) {
          console.log("🔥 FCM Token registered:", currentToken);
          setToken(currentToken);

          // Store token in Firestore
          await addDoc(collection(db, "fcm_tokens"), {
            token: currentToken,
            userId: "global", // For global notifications
            createdAt: serverTimestamp(),
            isActive: true
          });

          console.log("✅ FCM Token stored in Firestore");
        } else {
          console.log("❌ No FCM token received");
        }
      } catch (error) {
        console.error("❌ FCM registration error:", error);
      }
    };

    registerFCMToken();

    // Listen for foreground messages
    const messaging = getMessaging();
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("📨 Foreground FCM message:", payload);
      
      // Show notification for foreground messages
      if (payload.notification?.title) {
        // Use a unique tag for foreground notifications to avoid conflicts
        const uniqueTag = `foreground-${payload.data?.tag || Date.now()}`;
        
        new Notification(payload.notification.title, {
          body: payload.notification.body || "",
          icon: payload.notification.icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: uniqueTag,
          requireInteraction: false,
          data: payload.data || {},
          silent: false
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="hidden">
      {token && <div>FCM Token: {token.substring(0, 20)}...</div>}
    </div>
  );
}
