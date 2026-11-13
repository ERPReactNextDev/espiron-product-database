import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getUserById } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const tokenDocumentId = (token: string) =>
  createHash("sha256").update(token).digest("hex");

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
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json({ error: "A device token is required" }, { status: 400 });
    }

    const settings = body.notificationSettings ?? {};
    const notificationSettings = {
      enabled: settings.enabled !== false,
      productNotifications: settings.productNotifications !== false,
      supplierNotifications: settings.supplierNotifications !== false,
      spfNotifications: settings.spfNotifications !== false,
    };

    const tokenCollection = adminDb.collection("fcm_tokens");
    const documentId = tokenDocumentId(token);
    const existingDocuments = await tokenCollection.where("token", "==", token).get();
    const duplicates = existingDocuments.docs.filter((document) => document.id !== documentId);

    await Promise.all(duplicates.map((document) => document.ref.delete()));
    await tokenCollection.doc(documentId).set(
      {
        token,
        userId: user.id.toString(),
        deviceInfo: {
          userAgent: typeof body.deviceInfo?.userAgent === "string" ? body.deviceInfo.userAgent : "",
          platform: typeof body.deviceInfo?.platform === "string" ? body.deviceInfo.platform : "",
        },
        notificationSettings,
        isActive: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to register FCM device:", error);
    return NextResponse.json({ error: "Failed to register this device for notifications" }, { status: 500 });
  }
}
