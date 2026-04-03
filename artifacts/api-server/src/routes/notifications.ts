import { Router } from "express";
import { db } from "@workspace/db";
import { adminNotificationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth.js";
import { safeDecrypt } from "../crypto.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(adminNotificationsTable)
      .orderBy(desc(adminNotificationsTable.createdAt))
      .limit(50);

    return res.json({
      notifications: rows.map(n => ({
        id: n.id,
        type: n.type,
        letterId: n.letterId,
        message: safeDecrypt(n.message),
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: rows.filter(n => !n.isRead).length,
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.put("/read-all", requireAdmin, async (_req, res) => {
  try {
    await db.update(adminNotificationsTable).set({ isRead: true });
    return res.json({ success: true });
  } catch (err) {
    console.error("Read all notifications error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.put("/:id/read", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db
      .update(adminNotificationsTable)
      .set({ isRead: true })
      .where(eq(adminNotificationsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error("Read notification error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
