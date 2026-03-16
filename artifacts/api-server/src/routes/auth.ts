import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { adminSessionsTable } from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { hashToken } from "../crypto.js";

const router = Router();

// In-memory rate limiter: { ip -> { count, resetAt } }
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { blocked: true, remaining: 0 };
  }
  return { blocked: false, remaining: MAX_ATTEMPTS - record.count };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    record.count++;
  }
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function cleanExpiredSessions() {
  await db.delete(adminSessionsTable).where(lt(adminSessionsTable.expiresAt, new Date()));
}

// Get admin security questions (public)
router.get("/security-questions", (_req, res) => {
  const q1 = process.env.SECURITY_Q1 || "";
  const q2 = process.env.SECURITY_Q2 || "";
  // Only return questions if they're configured
  if (!q1 && !q2) return res.json({ q1: null, q2: null });
  return res.json({ q1, q2 });
});

router.post("/login", async (req: Request, res: Response) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

  const { blocked } = checkRateLimit(ip);
  if (blocked) {
    return res.status(429).json({
      error: "too_many_attempts",
      message: "محاولات كثيرة جداً، انتظر 15 دقيقة وحاول مجدداً",
    });
  }

  try {
    const { username, password, securityAnswer1, securityAnswer2 } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "missing_fields", message: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    const expectedUsername = process.env.ADMIN_USERNAME || "ahmed";
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";

    // Constant-time username comparison
    const usernameMatch = crypto.timingSafeEqual(
      Buffer.from(username.padEnd(64)),
      Buffer.from(expectedUsername.padEnd(64))
    );

    if (!usernameMatch) {
      recordFailedAttempt(ip);
      await bcrypt.hash("dummy", 10);
      return res.status(401).json({ error: "wrong_username", message: "اسم المستخدم غير صحيح" });
    }

    let passwordValid = false;
    if (passwordHash) {
      passwordValid = await bcrypt.compare(password, passwordHash);
    } else {
      const devPassword = process.env.ADMIN_PASSWORD || "admin123";
      passwordValid = password === devPassword;
    }

    if (!passwordValid) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: "wrong_password", message: "كلمة المرور غير صحيحة" });
    }

    // Verify security questions (always required if configured)
    const expectedA1 = process.env.SECURITY_A1;
    const expectedA2 = process.env.SECURITY_A2;

    if (expectedA1 || expectedA2) {
      if (!securityAnswer1 || !securityAnswer2) {
        return res.status(428).json({
          error: "security_questions_required",
          message: "يرجى الإجابة على أسئلة الأمان",
        });
      }

      const a1Match = expectedA1
        ? securityAnswer1.trim().toLowerCase() === expectedA1.trim().toLowerCase()
        : true;

      if (!a1Match) {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: "wrong_security_answer", which: 1, message: "إجابة السؤال الأول غير صحيحة" });
      }

      const a2Match = expectedA2
        ? securityAnswer2.trim().toLowerCase() === expectedA2.trim().toLowerCase()
        : true;

      if (!a2Match) {
        recordFailedAttempt(ip);
        return res.status(401).json({ error: "wrong_security_answer", which: 2, message: "إجابة السؤال الثاني غير صحيحة" });
      }
    }

    // All checks passed — clear rate limit and create session
    clearAttempts(ip);
    await cleanExpiredSessions();

    const rawToken = generateToken();
    const storedToken = hashToken(rawToken); // Store SHA-256 hash, send raw to client
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(adminSessionsTable).values({
      sessionToken: storedToken,
      expiresAt,
    });

    res.cookie("admin_session", rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({ authenticated: true, username: expectedUsername });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const rawToken = req.cookies?.admin_session;
    if (rawToken) {
      const storedToken = hashToken(rawToken);
      await db.delete(adminSessionsTable).where(eq(adminSessionsTable.sessionToken, storedToken));
    }
    res.clearCookie("admin_session", { path: "/" });
    return res.json({ success: true, message: "تم تسجيل الخروج" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const rawToken = req.cookies?.admin_session;
    if (!rawToken) {
      return res.status(401).json({ error: "not_authenticated", message: "غير مصادق" });
    }

    const storedToken = hashToken(rawToken);
    const sessions = await db
      .select()
      .from(adminSessionsTable)
      .where(eq(adminSessionsTable.sessionToken, storedToken));

    const session = sessions[0];

    if (!session || session.expiresAt < new Date()) {
      res.clearCookie("admin_session", { path: "/" });
      return res.status(401).json({ error: "session_expired", message: "انتهت الجلسة" });
    }

    const username = process.env.ADMIN_USERNAME || "ahmed";
    return res.json({ authenticated: true, username });
  } catch (err) {
    console.error("Auth me error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

export default router;
