import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, KeyRound, ChevronLeft, AlertCircle } from "lucide-react";
import { WaxSeal } from "@/components/WaxSeal";

type Step = "credentials" | "security";

interface FieldError {
  field: "username" | "password" | "q1" | "q2" | "general";
  message: string;
}

export default function Login() {
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
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

  const handleCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    if (!username.trim()) {
      setFieldError({ field: "username", message: "يرجى إدخال اسم المستخدم" });
      return;
    }
    if (!password.trim()) {
      setFieldError({ field: "password", message: "يرجى إدخال كلمة المرور" });
      return;
    }
    setStep("security");
  };

  const handleSecurityStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    if (q1 && !securityAnswer1.trim()) {
      setFieldError({ field: "q1", message: "يرجى الإجابة على السؤال الأول" });
      return;
    }
    if (q2 && !securityAnswer2.trim()) {
      setFieldError({ field: "q2", message: "يرجى الإجابة على السؤال الثاني" });
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
        return;
      }

      // Map server error to specific field
      if (data.error === "wrong_username") {
        setStep("credentials");
        setFieldError({ field: "username", message: "اسم المستخدم غير صحيح" });
      } else if (data.error === "wrong_password") {
        setStep("credentials");
        setFieldError({ field: "password", message: "كلمة المرور غير صحيحة" });
      } else if (data.error === "wrong_security_answer") {
        if (data.which === 1) {
          setSecurityAnswer1("");
          setFieldError({ field: "q1", message: "إجابة السؤال الأول غير صحيحة" });
        } else {
          setSecurityAnswer2("");
          setFieldError({ field: "q2", message: "إجابة السؤال الثاني غير صحيحة" });
        }
      } else if (data.error === "too_many_attempts") {
        setStep("credentials");
        setFieldError({ field: "general", message: data.message });
      } else {
        setFieldError({ field: "general", message: data.message || "حدث خطأ، حاول مجدداً" });
      }
    } catch {
      setFieldError({ field: "general", message: "تعذّر الاتصال بالخادم" });
    } finally {
      setIsLoading(false);
    }
  };

  const errorBox = (field: FieldError["field"]) =>
    fieldError?.field === field ? (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mt-1.5 text-destructive text-sm font-medium"
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        {fieldError.message}
      </motion.div>
    ) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative p-4 overflow-hidden">
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

          {fieldError?.field === "general" && (
            <div className="mx-6 mt-5 p-3 rounded-xl bg-destructive/10 text-destructive text-sm text-center font-medium border border-destructive/20 flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {fieldError.message}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === "credentials" && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="mx-auto w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 border border-primary/20">
                    <Lock className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-2xl">الخطوة الأولى</CardTitle>
                  <CardDescription>أدخل اسم المستخدم وكلمة المرور</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCredentials} className="space-y-4 pb-6">
                    <div>
                      <label className="text-sm font-semibold text-foreground/80 block mb-1.5">اسم المستخدم</label>
                      <Input
                        placeholder="أدخل اسم المستخدم"
                        value={username}
                        onChange={e => { setUsername(e.target.value); setFieldError(null); }}
                        autoComplete="username"
                        className={`h-12 ${fieldError?.field === "username" ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        autoFocus
                      />
                      {errorBox("username")}
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground/80 block mb-1.5">كلمة المرور</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setFieldError(null); }}
                        autoComplete="current-password"
                        className={`h-12 ${fieldError?.field === "password" ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {errorBox("password")}
                    </div>
                    <Button type="submit" variant="royal" className="w-full h-12 text-base mt-2">
                      المتابعة ←
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
                transition={{ duration: 0.3 }}
              >
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="mx-auto w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 border border-primary/20">
                    <KeyRound className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-2xl">الخطوة الثانية</CardTitle>
                  <CardDescription>أجب على أسئلة الأمان للتحقق من هويتك</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSecurityStep} className="space-y-4 pb-6">
                    {q1 && (
                      <div>
                        <label className="text-sm font-semibold text-foreground/80 block mb-1.5">{q1}</label>
                        <Input
                          placeholder="إجابتك هنا..."
                          value={securityAnswer1}
                          onChange={e => { setSecurityAnswer1(e.target.value); setFieldError(null); }}
                          className={`h-12 ${fieldError?.field === "q1" ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          autoFocus
                        />
                        {errorBox("q1")}
                      </div>
                    )}
                    {q2 && (
                      <div>
                        <label className="text-sm font-semibold text-foreground/80 block mb-1.5">{q2}</label>
                        <Input
                          placeholder="إجابتك هنا..."
                          value={securityAnswer2}
                          onChange={e => { setSecurityAnswer2(e.target.value); setFieldError(null); }}
                          className={`h-12 ${fieldError?.field === "q2" ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {errorBox("q2")}
                      </div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12"
                        onClick={() => { setStep("credentials"); setFieldError(null); }}
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
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"/>
                            </svg>
                            جارٍ التحقق...
                          </span>
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
