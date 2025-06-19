/**
 * Notification Client
 * 
 * This module provides functions to send notifications to users who have
 * added your frame to their account and enabled notifications.
 */

import {
  FrameNotificationDetails,
  type SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-sdk";
import { getUserNotificationDetails } from "@/lib/notification";

const appUrl = process.env.NEXT_PUBLIC_URL || "";

type SendFrameNotificationResult =
  | {
      state: "error";
      error: unknown;
    }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

/**
 * Send a notification to a user
 * 
 * @param fid - The user's Farcaster ID
 * @param title - Notification title
 * @param body - Notification body text
 * @param notificationDetails - Optional notification details (will fetch from Redis if not provided)
 * @returns Result of the notification send attempt
 */
export async function sendFrameNotification({
  fid,
  title,
  body,
  notificationDetails,
}: {
  fid: number;
  title: string;
  body: string;
  notificationDetails?: FrameNotificationDetails | null;
}): Promise<SendFrameNotificationResult> {
  // Get user's notification details from Redis if not provided
  if (!notificationDetails) {
    notificationDetails = await getUserNotificationDetails(fid);
  }
  
  // User hasn't enabled notifications
  if (!notificationDetails) {
    return { state: "no_token" };
  }

  // Send the notification using Farcaster's notification service
  const response = await fetch(notificationDetails.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId: crypto.randomUUID(),
      title,
      body,
      targetUrl: appUrl, // Where users go when they tap the notification
      tokens: [notificationDetails.token],
    } satisfies SendNotificationRequest),
  });

  const responseJson = await response.json();

  if (response.status === 200) {
    const responseBody = sendNotificationResponseSchema.safeParse(responseJson);
    if (responseBody.success === false) {
      return { state: "error", error: responseBody.error.errors };
    }

    // Check if user hit rate limit
    if (responseBody.data.result.rateLimitedTokens.length) {
      return { state: "rate_limit" };
    }

    return { state: "success" };
  }

  return { state: "error", error: responseJson };
}
