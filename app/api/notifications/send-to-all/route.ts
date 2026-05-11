import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";
import { createProductAddedNotification, createProductUpdatedNotification, createSupplierAddedNotification, createSupplierUpdatedNotification, createSPFCreatedNotification, createSPFUpdatedNotification, createSPFApprovedNotification, createSPFRejectedNotification } from "@/lib/notification-helpers";

export async function POST(request: NextRequest) {
  try {
    const { type, data, excludeUserId } = await request.json();

    if (!type || !data) {
      return NextResponse.json(
        { error: "Missing required fields: type, data" },
        { status: 400 }
      );
    }

    // Fetch all FCM tokens from all users (except the excluded user if provided)
    let query = supabase.from("fcm_tokens").select("*");
    
    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId);
    }

    const { data: tokens, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching FCM tokens:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch notification tokens" },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users to notify",
        notifiedCount: 0,
      });
    }

    // Create notification payload based on type
    let payload;
    switch (type) {
      case "product_added":
        payload = createProductAddedNotification(data);
        break;
      case "product_updated":
        payload = createProductUpdatedNotification(data);
        break;
      case "supplier_added":
        payload = createSupplierAddedNotification(data);
        break;
      case "supplier_updated":
        payload = createSupplierUpdatedNotification(data);
        break;
      case "spf_created":
        payload = createSPFCreatedNotification(data);
        break;
      case "spf_updated":
        payload = createSPFUpdatedNotification(data);
        break;
      case "spf_approved":
        payload = createSPFApprovedNotification(data);
        break;
      case "spf_rejected":
        payload = createSPFRejectedNotification(data);
        break;
      default:
        return NextResponse.json(
          { error: "Unknown notification type" },
          { status: 400 }
        );
    }

    // Group tokens by user to avoid duplicate notifications to same user
    const userTokensMap = new Map<string, string[]>();
    tokens.forEach((token: any) => {
      const userId = token.user_id;
      if (!userTokensMap.has(userId)) {
        userTokensMap.set(userId, []);
      }
      userTokensMap.get(userId)!.push(token.token);
    });

    // Send notifications to each user's devices
    const { messaging } = await import("@/lib/firebase");
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    for (const [userId, userTokenList] of userTokensMap) {
      try {
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
          tokens: userTokenList,
        };

        const response = await messaging.sendMulticast(message);
        totalSuccessCount += response.successCount;
        totalFailureCount += response.failureCount;

        // Clean up failed tokens
        if (response.responses) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp: any, idx: number) => {
            if (!resp.success) {
              failedTokens.push(userTokenList[idx]);
            }
          });

          // Remove failed tokens from database
          if (failedTokens.length > 0) {
            await supabase
              .from("fcm_tokens")
              .delete()
              .in("token", failedTokens);
          }
        }
      } catch (error) {
        console.error(`Error sending notifications to user ${userId}:`, error);
        totalFailureCount += userTokenList.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Notifications sent to all users",
      notifiedUsers: userTokensMap.size,
      totalSuccessCount,
      totalFailureCount,
    });
  } catch (error: any) {
    console.error("Error in send-to-all route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
