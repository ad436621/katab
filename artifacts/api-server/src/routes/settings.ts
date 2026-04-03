import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { adminConfigTable } from "@workspace/db/schema";
import { requireAdmin } from "../middleware/adminAuth.js";
import { encrypt, decrypt, safeDecrypt } from "../crypto.js";
import * as bcrypt from "bcryptjs";

const router = Router();

async function getAdminConfig() {
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

router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await getAdminConfig();
    return res.json({
      username: safeDecrypt(config.username),
      displayName: config.displayName ? safeDecrypt(config.displayName) : safeDecrypt(config.username),
      securityQ1: config.securityQ1 ? safeDecrypt(config.securityQ1) : "",
      securityQ2: config.securityQ2 ? safeDecrypt(config.securityQ2) : "",
      securityQ3: config.securityQ3 ? safeDecrypt(config.securityQ3) : "",
      hasSecurityA1: !!config.securityA1Hash,
      hasSecurityA2: !!config.securityA2Hash,
      hasSecurityA3: !!config.securityA3Hash,
    });
  } catch (err) {
    console.error("Get settings error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

router.put("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const config = await getAdminConfig();
    const { username, displayName, currentPassword, newPassword, securityQ1, securityA1, securityQ2, securityA2, securityQ3, securityA3 } = req.body;

    const updateData: any = { updatedAt: new Date() };

    if (username !== undefined) {
      if (!username.trim()) return res.status(400).json({ error: "invalid_username", message: "اسم المستخدم لا يمكن أن يكون فارغاً" });
      updateData.username = encrypt(username.trim());
    }

    if (displayName !== undefined) {
      updateData.displayName = encrypt(displayName.trim());
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "current_password_required", message: "كلمة المرور الحالية مطلوبة" });
      }
      const isValid = await bcrypt.compare(currentPassword, config.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "wrong_current_password", message: "كلمة المرور الحالية غير صحيحة" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "weak_password", message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (securityQ1 !== undefined) updateData.securityQ1 = securityQ1 ? encrypt(securityQ1) : null;
    if (securityQ2 !== undefined) updateData.securityQ2 = securityQ2 ? encrypt(securityQ2) : null;
    if (securityQ3 !== undefined) updateData.securityQ3 = securityQ3 ? encrypt(securityQ3) : null;
    if (securityA1 !== undefined) updateData.securityA1Hash = securityA1 ? await bcrypt.hash(securityA1.toLowerCase().trim(), 12) : null;
    if (securityA2 !== undefined) updateData.securityA2Hash = securityA2 ? await bcrypt.hash(securityA2.toLowerCase().trim(), 12) : null;
    if (securityA3 !== undefined) updateData.securityA3Hash = securityA3 ? await bcrypt.hash(securityA3.toLowerCase().trim(), 12) : null;

    const [updated] = await db.update(adminConfigTable).set(updateData).returning();

    const passwordChanged = !!newPassword;

    return res.json({
      success: true,
      passwordChanged,
      username: safeDecrypt(updated.username),
      displayName: updated.displayName ? safeDecrypt(updated.displayName) : safeDecrypt(updated.username),
    });
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(500).json({ error: "server_error", message: "خطأ في الخادم" });
  }
});

export { getAdminConfig };
export default router;
