import http from "http";
import app from "./app.js";
import { db } from "@workspace/db";
import { lettersTable, adminNotificationsTable } from "@workspace/db/schema";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { sendToAdmin, sendToLetter } from "./services/push.service.js";
import { setupWebSocket, broadcastToAdmin } from "./websocket.js";
import { encrypt, safeDecrypt } from "./crypto.js";

function validateEnvironment() {
  const errors: string[] = [];
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey) errors.push("ENCRYPTION_KEY is not set");
  else if (!/^[0-9a-f]{64}$/i.test(encKey)) errors.push(`ENCRYPTION_KEY must be exactly 64 hex characters (got ${encKey.length} chars)`);
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is not set");
  if (!process.env.VAPID_PUBLIC_KEY) errors.push("VAPID_PUBLIC_KEY is not set");
  if (!process.env.VAPID_PRIVATE_KEY) errors.push("VAPID_PRIVATE_KEY is not set");
  if (!process.env.VAPID_EMAIL) errors.push("VAPID_EMAIL is not set");
  if (errors.length > 0) {
    console.error("❌ Environment validation failed:");
    errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }
  console.log("✅ Environment validation passed");
}

validateEnvironment();

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = http.createServer(app);
setupWebSocket(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
  startScheduler();
});

async function createNotification(type: string, letterId: string, message: string) {
  try {
    await db.insert(adminNotificationsTable).values({ type, letterId, message: encrypt(message) });
  } catch (err) {
    console.error("createNotification error:", err);
  }
}

function startScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const lockedMessages = await db
        .select()
        .from(lettersTable)
        .where(
          and(
            isNotNull(lettersTable.scheduledUnlockAt),
            eq(lettersTable.isUnlocked, false),
            lte(lettersTable.scheduledUnlockAt, now)
          )
        );

      for (const letter of lockedMessages) {
        await db.update(lettersTable)
          .set({ isUnlocked: true, updatedAt: now })
          .where(eq(lettersTable.id, letter.id));

        if (!letter.unlockNotified) {
          const title = safeDecrypt(letter.title);
          const notifMsg = `تمت إتاحة الرسالة المجدولة: "${title}"`;
          await createNotification("message_unlocked", letter.id, notifMsg);

          sendToLetter(letter.uniqueToken, {
            type: "message_unlocked",
            title: "🔓 رسالتك فُتحت!",
            body: `الرسالة "${title}" متاحة الآن للقراءة`,
            url: `/letter/${letter.uniqueToken}`,
            letterId: letter.id,
          }).catch(() => {});

          sendToAdmin({
            type: "message_unlocked",
            title: "🔓 رسالة مجدولة فُتحت",
            body: notifMsg,
            url: `/letters/${letter.id}`,
            letterId: letter.id,
          }).catch(() => {});

          broadcastToAdmin({
            type: "message_unlocked",
            letterId: letter.id,
            title: safeDecrypt(letter.title),
            timestamp: Date.now(),
          });

          await db.update(lettersTable)
            .set({ unlockNotified: true })
            .where(eq(lettersTable.id, letter.id));
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, 60 * 1000);
}

export { broadcastToAdmin };
