import { Router } from "express";
import { db } from "@workspace/db";
import { lettersTable, questionsTable, repliesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { safeDecrypt } from "../crypto.js";
import * as bcrypt from "bcryptjs";

const router = Router();

// Rate limit unlock attempts per token
const unlockAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_UNLOCK = 10;
const WINDOW_MS = 30 * 60 * 1000;

function checkUnlockLimit(token: string): boolean {
  const now = Date.now();
  const record = unlockAttempts.get(token);
  if (!record || now > record.resetAt) {
    unlockAttempts.set(token, { count: 1, resetAt: now + WINDOW_MS });
    return true; // allowed
  }
  if (record.count >= MAX_UNLOCK) return false;
  record.count++;
  return true;
}

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const letters = await db
      .select()
      .from(lettersTable)
      .where(eq(lettersTable.uniqueToken, token));

    const letter = letters[0];

    if (!letter) {
      return res.status(404).json({ error: "not_found", message: "الرسالة غير موجودة" });
    }

    if (letter.status === "draft") {
      return res.status(403).json({ error: "not_sent", message: "هذه الرسالة لم ترسل بعد" });
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.letterId, letter.id))
      .orderBy(questionsTable.orderIndex);

    return res.json({
      title: safeDecrypt(letter.title),
      recipientName: safeDecrypt(letter.recipientName),
      language: letter.language,
      status: letter.status,
      questions: questions.map(q => ({
        id: q.id,
        questionText: safeDecrypt(q.questionText),
        orderIndex: q.orderIndex,
      })),
    });
  } catch (err) {
    console.error("Get letter by token error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.post("/:token/unlock", async (req, res) => {
  try {
    const { token } = req.params;
    const { answers } = req.body;

    if (!checkUnlockLimit(token)) {
      return res.status(429).json({ error: "too_many_attempts", message: "محاولات كثيرة، انتظر قليلاً" });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: "missing_answers", message: "الإجابات مطلوبة" });
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
      return res.status(403).json({ error: "not_sent", message: "هذه الرسالة لم ترسل بعد" });
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.letterId, letter.id))
      .orderBy(questionsTable.orderIndex);

    if (questions.length > 0) {
      for (const question of questions) {
        const userAnswer = answers.find((a: any) => a.questionId === question.id);
        if (!userAnswer) {
          return res.status(403).json({ error: "wrong_answers", message: "إجابة خاطئة أو ناقصة" });
        }
        const normalizedInput = userAnswer.answer?.toLowerCase().trim() || "";
        const storedHash = question.answerText;

        // Support both bcrypt hashes (new) and plain text (legacy pre-encryption rows)
        let match = false;
        if (storedHash.startsWith("$2b$") || storedHash.startsWith("$2a$")) {
          match = await bcrypt.compare(normalizedInput, storedHash);
        } else {
          match = normalizedInput === storedHash;
        }

        if (!match) {
          return res.status(403).json({ error: "wrong_answers", message: "إجابة خاطئة، حاول مرة أخرى" });
        }
      }
    }

    if (!letter.isRead) {
      await db
        .update(lettersTable)
        .set({ isRead: true, readAt: new Date(), status: "read", updatedAt: new Date() })
        .where(eq(lettersTable.id, letter.id));
    }

    const replies = await db
      .select()
      .from(repliesTable)
      .where(eq(repliesTable.letterId, letter.id))
      .orderBy(repliesTable.createdAt);

    return res.json({
      letter: {
        id: letter.id,
        title: safeDecrypt(letter.title),
        recipientName: safeDecrypt(letter.recipientName),
        uniqueToken: letter.uniqueToken,
        isRead: true,
        readAt: new Date().toISOString(),
        language: letter.language,
        status: "read",
        createdAt: letter.createdAt.toISOString(),
        updatedAt: letter.updatedAt.toISOString(),
        body: safeDecrypt(letter.body),
        replies: replies.map(r => ({
          id: r.id,
          letterId: r.letterId,
          replyBody: safeDecrypt(r.replyBody),
          replyFrom: r.replyFrom,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Unlock letter error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

export default router;
