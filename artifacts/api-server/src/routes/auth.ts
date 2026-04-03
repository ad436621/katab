import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { adminSessionsTable, adminConfigTable } from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { hashToken, encrypt, safeDecrypt } from "../crypto.js";

const router = Router();

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }
  if (record.count >= MAX_ATTEMPTS) return { blocked: true, remaining: 0 };
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

async function getOrSeedAdminConfig() {
  const rows = await db.select().from(adminConfigTable);
  if (rows.length > 0) return rows[0];

  const username = process.env.ADMIN_USERNAME || "ahmed";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";

  const [newRow] = await db.insert(adminConfigTable).values({
    username: encrypt(username),
    displayName: encrypt(username),
    passwordHash,
    securityQ1: process.env.SECURITY_Q1 ? encrypt(process.env.SECURITY_Q1) : null,
    securityQ2: process.env.SECURITY_Q2 ? encrypt(process.env.SECURITY_Q2) : null,
    securityQ3: null,
    securityA1Hash: process.env.SECURITY_A1 ? await bcrypt.hash(process.env.SECURITY_A1.toLowerCase().trim(), 12) : null,
    securityA2Hash: process.env.SECURITY_A2 ? await bcrypt.hash(process.env.SECURITY_A2.toLowerCase().trim(), 12) : null,
    securityA3Hash: null,
  }).returning();
  return newRow;
}

router.get("/security-questions", async (_req, res) => {
  try {
    const config = await getOrSeedAdminConfig();
    const q1 = config.securityQ1 ? safeDecrypt(config.securityQ1) : null;
    const q2 = config.securityQ2 ? safeDecrypt(config.securityQ2) : null;
    const q3 = config.securityQ3 ? safeDecrypt(config.securityQ3) : null;
    return res.json({ q1, q2, q3 });
  } catch (err) {
    console.error("Security questions error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

  const { blocked } = checkRateLimit(ip);
  if (blocked) {
    return res.status(429).json({ error: "too_many_attempts", message: "محاولات كثيرة جداً، انتظر 15 دقيقة وحاول مجدداً" });
  }

  try {
    const { username, password, securityAnswer1, securityAnswer2, securityAnswer3 } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "missing_fields", message: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    const config = await getOrSeedAdminConfig();
    const expectedUsername = safeDecrypt(config.username);

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
    if (config.passwordHash) {
      passwordValid = await bcrypt.compare(password, config.passwordHash);
    } else {
      const devPassword = process.env.ADMIN_PASSWORD || "admin123";
      passwordValid = password === devPassword;
    }

    if (!passwordValid) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: "wrong_password", message: "كلمة المرور غير صحيحة" });
    }

    const hasSecurityQuestions = config.securityA1Hash || config.securityA2Hash || config.securityA3Hash;

    if (hasSecurityQuestions) {
      const answersProvided = securityAnswer1 || securityAnswer2 || securityAnswer3;
      if (!answersProvided) {
        return res.status(428).json({ error: "security_questions_required", message: "يرجى الإجابة على أسئلة الأمان" });
      }

      if (config.securityA1Hash && securityAnswer1) {
        const a1Match = await bcrypt.compare(securityAnswer1.trim().toLowerCase(), config.securityA1Hash);
        if (!a1Match) {
          recordFailedAttempt(ip);
          return res.status(401).json({ error: "wrong_security_answer", which: 1, message: "إجابة السؤال الأول غير صحيحة" });
        }
      }

      if (config.securityA2Hash && securityAnswer2) {
        const a2Match = await bcrypt.compare(securityAnswer2.trim().toLowerCase(), config.securityA2Hash);
        if (!a2Match) {
          recordFailedAttempt(ip);
          return res.status(401).json({ error: "wrong_security_answer", which: 2, message: "إجابة السؤال الثاني غير صحيحة" });
        }
      }

      if (config.securityA3Hash && securityAnswer3) {
        const a3Match = await bcrypt.compare(securityAnswer3.trim().toLowerCase(), config.securityA3Hash);
        if (!a3Match) {
          recordFailedAttempt(ip);
          return res.status(401).json({ error: "wrong_security_answer", which: 3, message: "إجابة السؤال الثالث غير صحيحة" });
        }
      }
    }

    clearAttempts(ip);
    await cleanExpiredSessions();

    const rawToken = generateToken();
    const storedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(adminSessionsTable).values({ sessionToken: storedToken, expiresAt });

    res.cookie("admin_session", rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const displayName = config.displayName ? safeDecrypt(config.displayName) : expectedUsername;
    return res.json({ authenticated: true, username: expectedUsername, displayName });
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
    if (!rawToken) return res.status(401).json({ error: "not_authenticated", message: "غير مصادق" });

    const storedToken = hashToken(rawToken);
    const sessions = await db.select().from(adminSessionsTable).where(eq(adminSessionsTable.sessionToken, storedToken));
    const session = sessions[0];

    if (!session || session.expiresAt < new Date()) {
      res.clearCookie("admin_session", { path: "/" });
      return res.status(401).json({ error: "session_expired", message: "انتهت الجلسة" });
    }

    const config = await getOrSeedAdminConfig();
    const username = safeDecrypt(config.username);
    const displayName = config.displayName ? safeDecrypt(config.displayName) : username;
    return res.json({ authenticated: true, username, displayName });
  } catch (err) {
    console.error("Auth me error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

export default router;
