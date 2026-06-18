"use client";

import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { db, messaging } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "@/contexts/UserContext";

export function FCMTokenManager() {
  const [token, setToken] = useState<string | null>(null);
  const { userId, loading } = useUser();

  useEffect(() => {
    // Only register FCM token if user is logged in and loading is complete
    if (loading) {
      console.log("⏳ Loading user context, waiting...");
      return;
    }

    if (!userId) {
      console.log("🔒 User not logged in, skipping FCM token registration");
      return;
    }

    const registerFCMToken = async () => {
      try {
        if (!messaging) return;
        if (!("serviceWorker" in navigator)) return;

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

        const registration = await navigator.serviceWorker.ready;
        const currentToken = await getToken(messaging, {
          vapidKey: vapidKey as string,
          serviceWorkerRegistration: registration,
        });

        if (currentToken) {
          console.log("🔥 FCM Token registered:", currentToken);
          setToken(currentToken);

          // Store token in Firestore
          await addDoc(collection(db, "fcm_tokens"), {
            token: currentToken,
            userId: userId, // Use actual user ID instead of "global"
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
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload: any) => {
      console.log("📨 Foreground FCM message:", payload);
      
      // Show notification for foreground messages only if user is logged in
      if (payload.notification?.title && userId) {
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
  }, [userId, loading]);

  return (
    <div className="hidden">
      {token && <div>FCM Token: {token.substring(0, 20)}...</div>}
    </div>
  );
}
