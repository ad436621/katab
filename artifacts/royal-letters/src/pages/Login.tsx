import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Lock, KeyRound, ChevronLeft } from "lucide-react";
import { WaxSeal } from "@/components/WaxSeal";

type Step = "credentials" | "security";

export default function Login() {
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [q1, setQ1] = useState("ما هو اسم والدتك قبل الزواج؟");
  const [q2, setQ2] = useState("ما هو اسم مدرستك الابتدائية؟");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch("/api/auth/security-questions")
      .then(r => r.json())
      .then(data => {
        if (data.q1) setQ1(data.q1);
        if (data.q2) setQ2(data.q2);
      })
      .catch(() => {});
  }, []);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    // Try login without security answers first — if server requires them, move to step 2
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.status === 428 || data.error === "security_questions_required") {
        // Server wants security questions
        setStep("security");
        setError("");
      } else if (res.ok && data.authenticated) {
        setLocation("/dashboard");
      } else {
        setError(data.message || "بيانات الدخول غير صحيحة");
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecurityStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!securityAnswer1.trim() || !securityAnswer2.trim()) {
      setError("يرجى الإجابة على جميع الأسئلة");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, securityAnswer1, securityAnswer2 }),
      });
      const data = await res.json();

      if (res.ok && data.authenticated) {
        setLocation("/dashboard");
      } else {
        setError(data.message || "إجابة غير صحيحة");
        setSecurityAnswer1("");
        setSecurityAnswer2("");
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative p-4 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-parchment-pattern opacity-30 mix-blend-multiply pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.08)_0%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <WaxSeal className="w-20 h-20 mx-auto mb-4" />
          <h1 className="font-display text-4xl text-gradient-gold">بوابة الديوان</h1>
          <p className="text-muted-foreground mt-2 text-sm">الدخول مقصور على صاحب الديوان</p>
        </div>

        <Card className="border-[#C9A84C]/30 shadow-2xl bg-card/90 backdrop-blur-xl rounded-3xl overflow-hidden royal-shadow">
          <div className="h-1.5 w-full royal-gradient" />

          <AnimatePresence mode="wait">
            {step === "credentials" && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
              >
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="mx-auto w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 border border-primary/20">
                    <Lock className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-2xl">الخطوة الأولى</CardTitle>
                  <CardDescription>أدخل اسم المستخدم وكلمة المرور</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCredentials} className="space-y-5 pb-6">
                    {error && (
                      <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center font-medium border border-destructive/20">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground/80">اسم المستخدم</label>
                      <Input
                        placeholder="أدخل اسم المستخدم"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground/80">كلمة المرور</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="h-12"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="royal"
                      className="w-full h-12 text-base"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"/></svg>جارٍ التحقق...</span>
                      ) : "المتابعة"}
                    </Button>
                  </form>
                </CardContent>
              </motion.div>
            )}

            {step === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
              >
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="mx-auto w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 border border-primary/20">
                    <KeyRound className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-2xl">الخطوة الثانية</CardTitle>
                  <CardDescription>أجب على أسئلة الأمان للتحقق من هويتك</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSecurityStep} className="space-y-5 pb-6">
                    {error && (
                      <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center font-medium border border-destructive/20">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground/80">{q1}</label>
                      <Input
                        placeholder="إجابتك هنا..."
                        value={securityAnswer1}
                        onChange={(e) => setSecurityAnswer1(e.target.value)}
                        className="h-12"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground/80">{q2}</label>
                      <Input
                        placeholder="إجابتك هنا..."
                        value={securityAnswer2}
                        onChange={(e) => setSecurityAnswer2(e.target.value)}
                        className="h-12"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12"
                        onClick={() => { setStep("credentials"); setError(""); }}
                      >
                        <ChevronLeft className="w-4 h-4 me-1" /> رجوع
                      </Button>
                      <Button
                        type="submit"
                        variant="royal"
                        className="flex-1 h-12 text-base"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"/></svg>تحقق...</span>
                        ) : "دخول الديوان"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 opacity-60">
          هذه المنصة خاصة بصاحب الديوان — أحمد
        </p>
      </motion.div>
    </div>
  );
}
