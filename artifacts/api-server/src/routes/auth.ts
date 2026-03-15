import { Router } from "express";
import { db } from "@workspace/db";
import { adminSessionsTable } from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";

const router = Router();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function cleanExpiredSessions() {
  await db.delete(adminSessionsTable).where(lt(adminSessionsTable.expiresAt, new Date()));
}

// Get admin security questions (public)
router.get("/security-questions", (_req, res) => {
  const q1 = process.env.SECURITY_Q1 || "ما هو اسم والدتك قبل الزواج؟";
  const q2 = process.env.SECURITY_Q2 || "ما هو اسم مدرستك الابتدائية؟";
  return res.json({ q1, q2 });
});

router.post("/login", async (req, res) => {
  try {
    const { username, password, securityAnswer1, securityAnswer2 } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "missing_fields", message: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    const expectedUsername = process.env.ADMIN_USERNAME || "ahmed";
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";

    if (username !== expectedUsername) {
      return res.status(401).json({ error: "invalid_credentials", message: "بيانات الدخول غير صحيحة" });
    }

    let passwordValid = false;
    if (passwordHash) {
      passwordValid = await bcrypt.compare(password, passwordHash);
    } else {
      const devPassword = process.env.ADMIN_PASSWORD || "admin123";
      passwordValid = password === devPassword;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: "invalid_credentials", message: "بيانات الدخول غير صحيحة" });
    }

    // Verify security questions if they are configured
    const expectedA1 = process.env.SECURITY_A1;
    const expectedA2 = process.env.SECURITY_A2;

    if (expectedA1 || expectedA2) {
      if (!securityAnswer1 || !securityAnswer2) {
        return res.status(428).json({ 
          error: "security_questions_required", 
          message: "يرجى الإجابة على أسئلة الأمان"
        });
      }

      if (expectedA1 && securityAnswer1.toLowerCase().trim() !== expectedA1.toLowerCase().trim()) {
        return res.status(401).json({ error: "wrong_security_answer", message: "إجابة سؤال الأمان غير صحيحة" });
      }

      if (expectedA2 && securityAnswer2.toLowerCase().trim() !== expectedA2.toLowerCase().trim()) {
        return res.status(401).json({ error: "wrong_security_answer", message: "إجابة سؤال الأمان غير صحيحة" });
      }
    }

    await cleanExpiredSessions();

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(adminSessionsTable).values({
      sessionToken: token,
      expiresAt,
    });

    res.cookie("admin_session", token, {
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
    const token = req.cookies?.admin_session;
    if (token) {
      await db.delete(adminSessionsTable).where(eq(adminSessionsTable.sessionToken, token));
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
    const token = req.cookies?.admin_session;
    if (!token) {
      return res.status(401).json({ error: "not_authenticated", message: "غير مصادق" });
    }

    const sessions = await db
      .select()
      .from(adminSessionsTable)
      .where(eq(adminSessionsTable.sessionToken, token));

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
