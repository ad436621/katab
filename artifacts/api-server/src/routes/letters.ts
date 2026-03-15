import { Router } from "express";
import { db } from "@workspace/db";
import { lettersTable, questionsTable, repliesTable } from "@workspace/db/schema";
import { eq, desc, like, and, SQL } from "drizzle-orm";
import { requireAdmin } from "../middleware/adminAuth.js";
import * as crypto from "crypto";

const router = Router();

function generateToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

function formatLetter(letter: any) {
  return {
    id: letter.id,
    title: letter.title,
    recipientName: letter.recipientName,
    uniqueToken: letter.uniqueToken,
    isRead: letter.isRead,
    readAt: letter.readAt ? letter.readAt.toISOString() : null,
    language: letter.language,
    status: letter.status,
    createdAt: letter.createdAt.toISOString(),
    updatedAt: letter.updatedAt.toISOString(),
  };
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;

    const conditions: SQL[] = [];
    if (status) conditions.push(eq(lettersTable.status, status as any));
    if (search) conditions.push(like(lettersTable.title, `%${search}%`));

    const letters = await db
      .select()
      .from(lettersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(lettersTable.createdAt));

    return res.json({
      letters: letters.map(formatLetter),
      total: letters.length,
    });
  } catch (err) {
    console.error("List letters error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { title, body, recipientName, language = "arabic", status = "draft", questions = [] } = req.body;

    if (!title || !body || !recipientName) {
      return res.status(400).json({ error: "missing_fields", message: "العنوان والمحتوى واسم المستلم مطلوبة" });
    }

    const uniqueToken = generateToken();
    const now = new Date();

    const [letter] = await db.insert(lettersTable).values({
      title,
      body,
      recipientName,
      uniqueToken,
      language,
      status,
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (questions && questions.length > 0) {
      await db.insert(questionsTable).values(
        questions.map((q: any, i: number) => ({
          letterId: letter.id,
          questionText: q.questionText,
          answerText: q.answerText.toLowerCase().trim(),
          orderIndex: q.orderIndex ?? i,
        }))
      );
    }

    return res.status(201).json({ letter: formatLetter(letter) });
  } catch (err) {
    console.error("Create letter error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

// Admin: get full letter with answers (for editing)
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const letters = await db.select().from(lettersTable).where(eq(lettersTable.id, id));
    const letter = letters[0];

    if (!letter) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.letterId, id))
      .orderBy(questionsTable.orderIndex);

    const replies = await db
      .select()
      .from(repliesTable)
      .where(eq(repliesTable.letterId, id))
      .orderBy(repliesTable.createdAt);

    return res.json({
      letter: {
        ...formatLetter(letter),
        body: letter.body,
        // Return answers for admin editing
        questions: questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          answerText: q.answerText, // Admin can see answers
          orderIndex: q.orderIndex,
        })),
        replies: replies.map(r => ({
          id: r.id,
          letterId: r.letterId,
          replyBody: r.replyBody,
          replyFrom: r.replyFrom,
          isAdmin: r.replyFrom === "__admin__",
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Get letter error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, recipientName, language, status, questions } = req.body;

    const existing = await db.select().from(lettersTable).where(eq(lettersTable.id, id));
    if (!existing[0]) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (body !== undefined) updateData.body = body;
    if (recipientName !== undefined) updateData.recipientName = recipientName;
    if (language !== undefined) updateData.language = language;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db
      .update(lettersTable)
      .set(updateData)
      .where(eq(lettersTable.id, id))
      .returning();

    if (questions !== undefined) {
      await db.delete(questionsTable).where(eq(questionsTable.letterId, id));
      if (questions.length > 0) {
        await db.insert(questionsTable).values(
          questions.map((q: any, i: number) => ({
            letterId: id,
            questionText: q.questionText,
            answerText: q.answerText.toLowerCase().trim(),
            orderIndex: q.orderIndex ?? i,
          }))
        );
      }
    }

    return res.json({ letter: formatLetter(updated) });
  } catch (err) {
    console.error("Update letter error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(lettersTable).where(eq(lettersTable.id, id));
    if (!existing[0]) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    await db.delete(lettersTable).where(eq(lettersTable.id, id));

    return res.json({ success: true, message: "تم حذف الرسالة" });
  } catch (err) {
    console.error("Delete letter error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.post("/:id/send", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(lettersTable).where(eq(lettersTable.id, id));
    if (!existing[0]) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    const [updated] = await db
      .update(lettersTable)
      .set({ status: "sent", updatedAt: new Date() })
      .where(eq(lettersTable.id, id))
      .returning();

    return res.json({ letter: formatLetter(updated) });
  } catch (err) {
    console.error("Send letter error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

// Admin reply to a letter
router.post("/:id/admin-reply", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { replyBody } = req.body;

    if (!replyBody?.trim()) {
      return res.status(400).json({ error: "missing_body", message: "نص الرد مطلوب" });
    }

    const existing = await db.select().from(lettersTable).where(eq(lettersTable.id, id));
    if (!existing[0]) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    const adminName = process.env.ADMIN_USERNAME || "ahmed";

    const [reply] = await db.insert(repliesTable).values({
      letterId: id,
      replyBody,
      replyFrom: "__admin__",
    }).returning();

    return res.status(201).json({
      reply: {
        id: reply.id,
        letterId: reply.letterId,
        replyBody: reply.replyBody,
        replyFrom: adminName,
        isAdmin: true,
        createdAt: reply.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Admin reply error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

export default router;
