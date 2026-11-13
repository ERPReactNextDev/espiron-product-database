import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, adminMessaging } from "@/lib/firebase-admin";
import { getUserById } from "@/lib/supabase-admin";
import type { NotificationPayload, NotificationType } from "@/types/notifications";

export const runtime = "nodejs";

const NOTIFICATION_TYPES = new Set<NotificationType>([
  "product_added",
  "product_updated",
  "supplier_added",
  "supplier_updated",
  "spf_created",
  "spf_updated",
  "spf_approved",
  "spf_rejected",
]);

const preferenceForType = (type: NotificationType) =>
  type.startsWith("product_")
    ? "productNotifications"
    : type.startsWith("supplier_")
      ? "supplierNotifications"
      : type.startsWith("spf_")
        ? "spfNotifications"
        : null;

export async function POST(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const user = await getUserById(session);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as NotificationPayload;
    if (
      !payload ||
      !NOTIFICATION_TYPES.has(payload.type) ||
      typeof payload.title !== "string" ||
      typeof payload.body !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid notification payload" },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection("fcm_tokens")
      .where("isActive", "==", true)
      .get();
    const preferenceKey = preferenceForType(payload.type);
    const eligibleDevices = new Map<
      string,
      QueryDocumentSnapshot
    >();

    snapshot.docs.forEach((document) => {
      const device = document.data();
      const settings = device.notificationSettings;
      if (!device.token || device.userId === user.id.toString()) return;
      if (settings?.enabled === false) return;
      if (preferenceKey && settings?.[preferenceKey] === false) return;
      eligibleDevices.set(device.token, document);
    });

    const devices = [...eligibleDevices.entries()];
    const urlPath =
      typeof payload.data?.url === "string" && payload.data.url.startsWith("/") && !payload.data.url.startsWith("//")
        ? payload.data.url
        : "/products";
    const data = Object.fromEntries(
      Object.entries(payload.data ?? {})
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])
    );
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...data,
        type: payload.type,
        tag: payload.tag || payload.type,
        requireInteraction: String(payload.requireInteraction === true),
        url: urlPath,
        actions: JSON.stringify(payload.actions || []),
      },
      webpush: {
        notification: {
          icon: payload.icon || "/favicon.ico",
          badge: payload.badge || "/favicon.ico",
          tag: payload.tag || payload.type,
          requireInteraction: payload.requireInteraction === true,
          actions: payload.actions?.map(({ action, title, icon }) => ({ action, title, icon })),
        },
        fcmOptions: {
          link: new URL(urlPath, request.nextUrl.origin).toString(),
        },
      },
    };

    let successCount = 0;
    let failureCount = 0;
    const invalidDocumentIds: string[] = [];

    for (let offset = 0; offset < devices.length; offset += 500) {
      const batch = devices.slice(offset, offset + 500);
      const response = await adminMessaging.sendEachForMulticast({
        ...message,
        tokens: batch.map(([token]) => token),
      });

      successCount += response.successCount;
      failureCount += response.failureCount;
      response.responses.forEach((result, index) => {
        if (
          !result.success &&
          (result.error?.code === "messaging/registration-token-not-registered" ||
            result.error?.code === "messaging/invalid-registration-token")
        ) {
          invalidDocumentIds.push(batch[index][1].id);
        }
      });
    }

    if (invalidDocumentIds.length > 0) {
      await Promise.all(
        invalidDocumentIds.map((id) => adminDb.collection("fcm_tokens").doc(id).delete())
      );
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      totalSent: devices.length,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
