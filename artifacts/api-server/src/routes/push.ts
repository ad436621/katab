import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth.js";
import webpush from "web-push";

const router = Router();

function setupWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:admin@royalletters.app";
  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
  }
}

setupWebPush();

router.get("/vapid-key", (_req: Request, res: Response) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return res.status(503).json({ error: "vapid_not_configured" });
  return res.json({ publicKey });
});

router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { endpoint, p256dh, auth, letterToken, isAdmin: isAdminSub = false } = req.body;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "missing_fields", message: "بيانات الاشتراك مطلوبة" });
    }

    const existing = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));

    if (existing.length > 0) {
      await db.update(pushSubscriptionsTable).set({
        p256dh,
        auth,
        letterToken: letterToken || null,
        isAdmin: !!isAdminSub,
      }).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    } else {
      await db.insert(pushSubscriptionsTable).values({
        endpoint,
        p256dh,
        auth,
        letterToken: letterToken || null,
        isAdmin: !!isAdminSub,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.delete("/unsubscribe", async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export async function sendPushToAdmins(payload: { title: string; body: string; url?: string }) {
  try {
    const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.isAdmin, true));
    const notifPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/icon-192.png",
      url: payload.url || "/dashboard",
    });
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notifPayload
        ).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, sub.endpoint)).catch(() => {});
          }
        })
      )
    );
  } catch (err) {
    console.error("sendPushToAdmins error:", err);
  }
}

export async function sendPushToToken(letterToken: string, payload: { title: string; body: string; url?: string }) {
  try {
    const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.letterToken, letterToken));
    const notifPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/icon-192.png",
      url: payload.url || `/letter/${letterToken}`,
    });
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notifPayload
        ).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, sub.endpoint)).catch(() => {});
          }
        })
      )
    );
  } catch (err) {
    console.error("sendPushToToken error:", err);
  }
}

export default router;
