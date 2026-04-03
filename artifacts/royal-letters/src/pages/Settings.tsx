import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Lock, User, Shield, Loader2, Eye, EyeOff, Bell, BellOff } from "lucide-react";
import { useLocation } from "wouter";

interface AdminSettings {
  username: string;
  displayName: string;
  securityQ1: string;
  securityQ2: string;
  securityQ3: string;
  hasSecurityA1: boolean;
  hasSecurityA2: boolean;
  hasSecurityA3: boolean;
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 ${
      type === "success" ? "bg-green-600 text-white" : "bg-destructive text-white"
    }`}>
      {message}
    </div>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showCurrPass, setShowCurrPass] = useState(false);

  const [securityQ1, setSecurityQ1] = useState("");
  const [securityA1, setSecurityA1] = useState("");
  const [securityQ2, setSecurityQ2] = useState("");
  const [securityA2, setSecurityA2] = useState("");
  const [securityQ3, setSecurityQ3] = useState("");
  const [securityA3, setSecurityA3] = useState("");

  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifSubscribed, setNotifSubscribed] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${apiBase}/api/auth/settings`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setUsername(data.username || "");
        setDisplayName(data.displayName || "");
        setSecurityQ1(data.securityQ1 || "");
        setSecurityQ2(data.securityQ2 || "");
        setSecurityQ3(data.securityQ3 || "");
      })
      .catch(() => showToast("فشل تحميل الإعدادات", "error"))
      .finally(() => setLoading(false));

    if ("Notification" in window && "serviceWorker" in navigator) {
      setNotifSupported(true);
      setNotifPermission(Notification.permission);
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setNotifSubscribed(!!sub);
        });
      });
    }
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/auth/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, displayName }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("تم تحديث الملف الشخصي بنجاح", "success");
      } else {
        showToast(data.message || "فشل الحفظ", "error");
      }
    } catch {
      showToast("خطأ في الاتصال", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      showToast("كلمتا المرور غير متطابقتين", "error");
      return;
    }
    if (newPassword.length < 8) {
      showToast("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/auth/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("تم تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          fetch(`${apiBase}/api/auth/logout`, { method: "POST", credentials: "include" });
          setLocation("/login");
        }, 2000);
      } else {
        showToast(data.message || "فشل تغيير كلمة المرور", "error");
      }
    } catch {
      showToast("خطأ في الاتصال", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveQuestions() {
    setSavingQuestions(true);
    try {
      const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const body: any = { securityQ1, securityQ2, securityQ3 };
      if (securityA1) body.securityA1 = securityA1;
      if (securityA2) body.securityA2 = securityA2;
      if (securityA3) body.securityA3 = securityA3;
      const res = await fetch(`${apiBase}/api/auth/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("تم تحديث أسئلة الأمان", "success");
        setSecurityA1("");
        setSecurityA2("");
        setSecurityA3("");
      } else {
        showToast(data.message || "فشل الحفظ", "error");
      }
    } catch {
      showToast("خطأ في الاتصال", "error");
    } finally {
      setSavingQuestions(false);
    }
  }

  async function subscribeToNotifications() {
    setNotifLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== "granted") {
        showToast("لم يتم منح إذن الإشعارات", "error");
        return;
      }
      const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const keyRes = await fetch(`${apiBase}/api/push/vapid-key`, { credentials: "include" });
      if (!keyRes.ok) { showToast("خطأ في تهيئة الإشعارات", "error"); return; }
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON();
      await fetch(`${apiBase}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          isAdmin: true,
        }),
      });
      setNotifSubscribed(true);
      showToast("تم تفعيل الإشعارات بنجاح", "success");
    } catch (err) {
      showToast("فشل تفعيل الإشعارات", "error");
    } finally {
      setNotifLoading(false);
    }
  }

  async function unsubscribeFromNotifications() {
    setNotifLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
        await fetch(`${apiBase}/api/push/unsubscribe`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setNotifSubscribed(false);
      showToast("تم إيقاف الإشعارات", "success");
    } catch {
      showToast("فشل إيقاف الإشعارات", "error");
    } finally {
      setNotifLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center p-20">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <h1 className="font-display text-2xl text-foreground">الإعدادات الشخصية</h1>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> الملف الشخصي</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">اسم المستخدم (للدخول)</label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم" className="h-11" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">الاسم المعروض</label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="الاسم الذي يظهر في الواجهة" className="h-11" />
            </div>
            <Button onClick={saveProfile} disabled={savingProfile} className="w-full h-11 gap-2" variant="royal">
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الملف الشخصي
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> تغيير كلمة المرور</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">كلمة المرور الحالية</label>
              <div className="relative">
                <Input
                  type={showCurrPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="كلمة المرور الحالية"
                  className="h-11 pl-10"
                />
                <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrPass(!showCurrPass)}>
                  {showCurrPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">كلمة المرور الجديدة</label>
              <div className="relative">
                <Input
                  type={showNewPass ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)"
                  className="h-11 pl-10"
                />
                <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPass(!showNewPass)}>
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">تأكيد كلمة المرور الجديدة</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="أعد كتابة كلمة المرور الجديدة"
                className="h-11"
              />
            </div>
            <Button onClick={savePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full h-11 gap-2 bg-amber-700 hover:bg-amber-800 text-white">
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              تغيير كلمة المرور
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> أسئلة الأمان</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {[
              { q: securityQ1, setQ: setSecurityQ1, a: securityA1, setA: setSecurityA1, hasA: settings?.hasSecurityA1, num: 1 },
              { q: securityQ2, setQ: setSecurityQ2, a: securityA2, setA: setSecurityA2, hasA: settings?.hasSecurityA2, num: 2 },
              { q: securityQ3, setQ: setSecurityQ3, a: securityA3, setA: setSecurityA3, hasA: settings?.hasSecurityA3, num: 3 },
            ].map(({ q, setQ, a, setA, hasA, num }) => (
              <div key={num} className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-3">
                <span className="text-xs font-bold text-primary">السؤال {num}</span>
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`نص السؤال ${num}`} className="h-11" />
                <Input
                  type="password"
                  value={a}
                  onChange={e => setA(e.target.value)}
                  placeholder={hasA ? "اتركه فارغاً للإبقاء على الإجابة الحالية" : "الإجابة الصحيحة"}
                  className="h-11"
                />
              </div>
            ))}
            <Button onClick={saveQuestions} disabled={savingQuestions} className="w-full h-11 gap-2" variant="royal">
              {savingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              حفظ أسئلة الأمان
            </Button>
          </CardContent>
        </Card>

        {notifSupported && (
          <Card className="border-[#C9A84C]/30 shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border/50">
              <CardTitle className="text-lg flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> الإشعارات</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                احصل على إشعارات فورية عند وصول ردود جديدة أو قراءة رسائلك.
              </p>
              {notifPermission === "denied" ? (
                <p className="text-sm text-destructive">تم رفض الإشعارات. يرجى تفعيلها من إعدادات المتصفح.</p>
              ) : notifSubscribed ? (
                <Button onClick={unsubscribeFromNotifications} disabled={notifLoading} variant="outline" className="w-full h-11 gap-2">
                  {notifLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
                  إيقاف الإشعارات
                </Button>
              ) : (
                <Button onClick={subscribeToNotifications} disabled={notifLoading} variant="royal" className="w-full h-11 gap-2">
                  {notifLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  تفعيل الإشعارات
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
