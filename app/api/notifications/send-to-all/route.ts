import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";
import { messaging } from "@/lib/firebase";
import { NotificationPayload } from "@/types/notifications";

export async function POST(request: NextRequest) {
  try {
    const { payload } = await request.json();

    if (!payload || !payload.title || !payload.body) {
      return NextResponse.json(
        { error: "Missing required payload fields: title, body" },
        { status: 400 }
      );
    }

    // Get all FCM tokens from database (including creator)
    const { data: tokens, error } = await supabase
      .from("fcm_tokens")
      .select("token, user_id");

    if (error) {
      console.error("Error fetching FCM tokens:", error);
      return NextResponse.json(
        { error: "Failed to fetch notification tokens" },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users to notify",
        totalSent: 0,
      });
    }

    const tokenList = tokens.map(t => t.token);
    const uniqueTokens = [...new Set(tokenList)]; // Remove duplicates

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
      tokens: uniqueTokens,
    };

    const response = await messaging.sendMulticast(message);

    const successCount = response.successCount;
    const failureCount = response.failureCount;
    const failedTokens: string[] = [];

    if (response.responses) {
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          failedTokens.push(uniqueTokens[idx]);
        }
      });
    }

    // Clean up failed tokens
    if (failedTokens.length > 0) {
      await supabase
        .from("fcm_tokens")
        .delete()
        .in("token", failedTokens);
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      failedTokens,
      totalSent: uniqueTokens.length,
    });
  } catch (error: any) {
    console.error("Error sending broadcast notification:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send broadcast notification" },
      { status: 500 }
    );
  }
}
