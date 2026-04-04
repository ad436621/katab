import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface NotificationPayload {
  type: "new_reply" | "letter_read" | "message_unlocked" | "new_letter";
  title: string;
  body: string;
  url: string;
  letterId?: string;
  recipientName?: string;
  tag?: string;
  requireInteraction?: boolean;
}

function buildPushPayload(payload: NotificationPayload): string {
  const vibrate = [200, 100, 200];
  const actions = (() => {
    if (payload.type === "new_reply") return [
      { action: "open", title: "📖 فتح الرسالة" },
      { action: "dismiss", title: "✕ إغلاق" },
    ];
    if (payload.type === "letter_read") return [
      { action: "open", title: "👁 عرض الرسالة" },
    ];
    if (payload.type === "message_unlocked") return [
      { action: "open", title: "🔓 فتح الآن" },
      { action: "dismiss", title: "لاحقاً" },
    ];
    return [{ action: "open", title: "فتح" }];
  })();

  return JSON.stringify({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: payload.tag || payload.letterId || payload.type,
    renotify: true,
    requireInteraction: payload.type === "new_reply",
    silent: false,
    vibrate,
    url: payload.url,
    letterId: payload.letterId,
    actions,
  });
}

async function sendNotification(
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string
): Promise<"ok" | "expired" | "error"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payloadStr
    );
    return "ok";
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) return "expired";
    if (err.statusCode === 429) {
      console.warn("[push] Rate limited for endpoint:", sub.endpoint.slice(0, 40));
      return "error";
    }
    console.error("[push] Send error:", err.message);
    return "error";
  }
}

export async function sendToAdmin(payload: NotificationPayload): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.isAdmin, true));

    const payloadStr = buildPushPayload(payload);
    const expired: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        const result = await sendNotification(sub, payloadStr);
        if (result === "expired") expired.push(sub.endpoint);
      })
    );

    if (expired.length > 0) {
      await Promise.allSettled(
        expired.map(ep =>
          db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, ep))
        )
      );
    }
  } catch (err) {
    console.error("[push] sendToAdmin error:", err);
  }
}

export async function sendToLetter(token: string, payload: NotificationPayload): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.letterToken, token));

    const payloadStr = buildPushPayload(payload);
    const expired: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        const result = await sendNotification(sub, payloadStr);
        if (result === "expired") expired.push(sub.endpoint);
      })
    );

    if (expired.length > 0) {
      await Promise.allSettled(
        expired.map(ep =>
          db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, ep))
        )
      );
    }
  } catch (err) {
    console.error("[push] sendToLetter error:", err);
  }
}
