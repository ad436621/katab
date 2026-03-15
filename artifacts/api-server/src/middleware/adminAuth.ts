import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { adminSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.admin_session;
    if (!token) {
      return res.status(401).json({ error: "not_authenticated", message: "يجب تسجيل الدخول" });
    }

    const sessions = await db
      .select()
      .from(adminSessionsTable)
      .where(eq(adminSessionsTable.sessionToken, token));

    const session = sessions[0];

    if (!session || session.expiresAt < new Date()) {
      res.clearCookie("admin_session", { path: "/" });
      return res.status(401).json({ error: "session_expired", message: "انتهت الجلسة، يرجى تسجيل الدخول مجدداً" });
    }

    next();
  } catch (err) {
    console.error("Admin auth middleware error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
}
