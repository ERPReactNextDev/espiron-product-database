import { NextRequest, NextResponse } from "next/server";
import { messaging } from "@/lib/firebase";
import { NotificationPayload } from "@/types/notifications";

export async function POST(request: NextRequest) {
  try {
    const { userId, tokens, payload } = await request.json();

    if (!userId || !tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: userId, tokens" },
        { status: 400 }
      );
    }

    if (!payload || !payload.title || !payload.body) {
      return NextResponse.json(
        { error: "Missing required payload fields: title, body" },
        { status: 400 }
      );
    }

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/favicon.ico",
      },
      data: {
        ...payload.data,
        type: payload.type,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction,
        url: payload.data?.url,
        actions: JSON.stringify(payload.actions || []),
      },
      tokens: tokens,
    };

    const response = await messaging.sendMulticast(message);

    const successCount = response.successCount;
    const failureCount = response.failureCount;
    const failedTokens: string[] = [];

    if (response.responses) {
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      failedTokens,
      totalSent: tokens.length,
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
