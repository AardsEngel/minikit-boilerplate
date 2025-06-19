/**
 * Notification Example
 * 
 * This example shows how to send notifications to users who have
 * added your frame and enabled notifications.
 */

import { sendFrameNotification } from "@/lib/notification-client";

// Example: Send a welcome notification
export async function sendWelcomeNotification(userFid: number) {
  const result = await sendFrameNotification({
    fid: userFid,
    title: "Welcome to My App! 🎉",
    body: "Thanks for adding our frame. Get started by exploring the features!",
  });

  switch (result.state) {
    case "success":
      console.log("Notification sent successfully!");
      break;
    case "no_token":
      console.log("User hasn't enabled notifications");
      break;
    case "rate_limit":
      console.log("Rate limited - try again later");
      break;
    case "error":
      console.error("Failed to send notification:", result.error);
      break;
  }

  return result;
}

// Example: Send a custom notification
export async function sendCustomNotification(
  userFid: number,
  title: string,
  message: string
) {
  return await sendFrameNotification({
    fid: userFid,
    title,
    body: message,
  });
}

// Example: Send notifications to multiple users
export async function sendBulkNotifications(
  userFids: number[],
  title: string,
  message: string
) {
  const results = await Promise.all(
    userFids.map(fid => 
      sendFrameNotification({
        fid,
        title,
        body: message,
      })
    )
  );

  const successful = results.filter(r => r.state === "success").length;
  const failed = results.length - successful;

  console.log(`Sent ${successful} notifications, ${failed} failed`);
  
  return results;
}

// Example: Send notification from API route
// Usage in app/api/my-endpoint/route.ts:
/*
import { sendWelcomeNotification } from "@/examples/notification-example";

export async function POST(request: Request) {
  const { userFid } = await request.json();
  
  const result = await sendWelcomeNotification(userFid);
  
  return Response.json({ success: result.state === "success" });
}
*/ 