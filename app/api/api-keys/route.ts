import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  getDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { getUserById } from "@/lib/supabase-admin";
import crypto from "crypto";

function generateApiKey(): string {
  return "esp_" + crypto.randomBytes(32).toString("hex");
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function verifyITAccess(
  sessionCookie: string | undefined
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!sessionCookie) return { valid: false, error: "No session found" };
  try {
    const user = await getUserById(sessionCookie);
    if (!user) return { valid: false, error: "User not found" };
    if (user.Department !== "IT")
      return { valid: false, error: "Access denied. IT department only." };
    return { valid: true, userId: user.UserId || user.id.toString() };
  } catch {
    return { valid: false, error: "Authentication error" };
  }
}

async function handleRequest(req: NextRequest) {
  const cookies = req.cookies;
  const session = cookies.get("session")?.value;
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");

  const auth = await verifyITAccess(session);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    switch (action) {
      case "generate": {
        const body = await req.json();
        const { name, description, permissions = ["products:read", "suppliers:read"] } = body;
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const apiKey = generateApiKey();
        const hashedKey = hashApiKey(apiKey);
        const keyData = {
          keyId: crypto.randomUUID(),
          hashedKey,
          name,
          description: description || "",
          permissions,
          isActive: true,
          createdAt: Timestamp.now(),
          createdBy: auth.userId,
          lastUsedAt: null,
          usageCount: 0,
        };
        await setDoc(doc(db, "apiKeys", keyData.keyId), keyData);
        return NextResponse.json(
          {
            success: true,
            apiKey,
            keyData: {
              keyId: keyData.keyId,
              name: keyData.name,
              description: keyData.description,
              permissions: keyData.permissions,
              isActive: keyData.isActive,
              createdAt: keyData.createdAt.toDate().toISOString(),
              createdBy: keyData.createdBy,
            },
            message: "API Key generated successfully. Store this key securely - it will not be shown again.",
          },
          { status: 201 }
        );
      }

      case "list": {
        const keysQuery = query(collection(db, "apiKeys"), where("isActive", "==", true));
        const snapshot = await getDocs(keysQuery);
        const keys = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            keyId: data.keyId,
            name: data.name,
            description: data.description,
            permissions: data.permissions,
            isActive: data.isActive,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            createdBy: data.createdBy,
            lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString() || null,
            usageCount: data.usageCount || 0,
          };
        });
        return NextResponse.json({ keys });
      }

      case "revoke": {
        const body = await req.json();
        const { keyId } = body;
        if (!keyId) return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
        const keyRef = doc(db, "apiKeys", keyId);
        const keyDoc = await getDoc(keyRef);
        if (!keyDoc.exists()) return NextResponse.json({ error: "API key not found" }, { status: 404 });
        await updateDoc(keyRef, { isActive: false, revokedAt: Timestamp.now(), revokedBy: auth.userId });
        return NextResponse.json({ success: true, message: "API key revoked successfully" });
      }

      case "delete": {
        const body = await req.json();
        const { keyId } = body;
        if (!keyId) return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
        const keyRef = doc(db, "apiKeys", keyId);
        const keyDoc = await getDoc(keyRef);
        if (!keyDoc.exists()) return NextResponse.json({ error: "API key not found" }, { status: 404 });
        await deleteDoc(keyRef);
        return NextResponse.json({ success: true, message: "API key deleted permanently" });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("API Keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
