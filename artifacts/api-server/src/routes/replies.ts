import { Router } from "express";
import { db } from "@workspace/db";
import { lettersTable, questionsTable, repliesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { token, replyBody, replyFrom } = req.body;

    if (!token || !replyBody || !replyFrom) {
      return res.status(400).json({ error: "missing_fields", message: "جميع الحقول مطلوبة" });
    }

    const letters = await db
      .select()
      .from(lettersTable)
      .where(eq(lettersTable.uniqueToken, token));

    const letter = letters[0];

    if (!letter) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    if (letter.status === "draft") {
      return res.status(403).json({ error: "forbidden", message: "لا يمكن الرد على رسالة غير مرسلة" });
    }

    const [reply] = await db.insert(repliesTable).values({
      letterId: letter.id,
      replyBody,
      replyFrom,
    }).returning();

    await db
      .update(lettersTable)
      .set({ status: "replied", updatedAt: new Date() })
      .where(eq(lettersTable.id, letter.id));

    return res.status(201).json({
      reply: {
        id: reply.id,
        letterId: reply.letterId,
        replyBody: reply.replyBody,
        replyFrom: reply.replyFrom,
        createdAt: reply.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Create reply error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.get("/:letterId", requireAdmin, async (req, res) => {
  try {
    const { letterId } = req.params;

    const replies = await db
      .select()
      .from(repliesTable)
      .where(eq(repliesTable.letterId, letterId))
      .orderBy(desc(repliesTable.createdAt));

    return res.json({
      replies: replies.map(r => ({
        id: r.id,
        letterId: r.letterId,
        replyBody: r.replyBody,
        replyFrom: r.replyFrom,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Get replies error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

export default router;
