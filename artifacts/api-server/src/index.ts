import app from "./app.js";
import { db } from "@workspace/db";
import { lettersTable } from "@workspace/db/schema";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { sendPushToAdmins, sendPushToToken } from "./routes/push.js";
import { safeDecrypt } from "./crypto.js";

const rawPort = process.env["PORT"];

if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
  startScheduler();
});

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
        await db.update(lettersTable).set({ isUnlocked: true, updatedAt: now }).where(eq(lettersTable.id, letter.id));

        if (!letter.unlockNotified) {
          const title = safeDecrypt(letter.title);
          await sendPushToToken(letter.uniqueToken, {
            title: "🔓 رسالتك فُتحت!",
            body: `الرسالة "${title}" متاحة الآن للقراءة`,
            url: `/letter/${letter.uniqueToken}`,
          });
          await sendPushToAdmins({
            title: "🔓 رسالة مجدولة فُتحت",
            body: `تمت إتاحة الرسالة: "${title}"`,
            url: `/letters/${letter.id}`,
          });
          await db.update(lettersTable).set({ unlockNotified: true }).where(eq(lettersTable.id, letter.id));
        }
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, 60 * 1000);
}
