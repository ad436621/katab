import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const loginMutation = useAdminLogin();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ data: { username, password } });
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err?.message || "بيانات الدخول غير صحيحة");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative p-4">
      <div className="absolute inset-0 bg-parchment-pattern opacity-30 mix-blend-multiply pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-[#C9A84C]/30 shadow-2xl bg-card/90 backdrop-blur-xl rounded-3xl overflow-hidden">
          <div className="h-2 w-full royal-gradient" />
          <CardHeader className="text-center pt-8 pb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4 border border-primary/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <CardTitle className="text-3xl text-gradient-gold">بوابة الديوان</CardTitle>
            <CardDescription className="text-base mt-2">تسجيل الدخول للمسؤولين فقط</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6 pb-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center font-medium border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">اسم المستخدم</label>
                  <Input 
                    placeholder="أدخل اسم المستخدم" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    dir="ltr"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">كلمة المرور</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    className="text-right"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                variant="royal" 
                className="w-full" 
                isLoading={loginMutation.isPending}
              >
                دخول
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
