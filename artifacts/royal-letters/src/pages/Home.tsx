import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WaxSeal } from "@/components/WaxSeal";
import { Search } from "lucide-react";

export default function Home() {
  const [token, setToken] = useState("");
  const [, setLocation] = useLocation();

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      setLocation(`/letter/${token.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-parchment-pattern opacity-40 mix-blend-multiply pointer-events-none" />
      <div 
        className="absolute inset-0 pointer-events-none opacity-30" 
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/gold-particles.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_100%)] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-6 text-center"
      >
        <div className="mb-8 flex justify-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
          >
            <WaxSeal className="w-32 h-32" />
          </motion.div>
        </div>

        <h1 className="font-display text-6xl text-gradient-gold mb-4 drop-shadow-sm">الرسائل الملكية</h1>
        <p className="font-sans text-muted-foreground text-lg mb-12 max-w-sm mx-auto leading-relaxed">
          أدخل الرمز الملكي لفتح الرسالة الموجهة إليكم، والمختومة بخاتم الديوان.
        </p>

        <form onSubmit={handleOpen} className="relative">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="أدخل الرمز السري هنا..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-16 text-center text-lg font-sans bg-card/80 backdrop-blur-sm border-[#C9A84C]/50 focus-visible:ring-[#C9A84C] shadow-lg rounded-2xl"
                dir="ltr"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-6 h-6" />
            </div>
            <Button 
              type="submit" 
              variant="royal" 
              size="lg"
              className="w-full rounded-2xl h-14 text-xl font-display tracking-wide"
              disabled={!token.trim()}
            >
              فض الختم وفتح الرسالة
            </Button>
          </div>
        </form>
      </motion.div>

      {/* Subtle admin link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-6 z-10"
      >
        <a
          href="/login"
          className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors font-sans"
        >
          دخول الديوان
        </a>
      </motion.div>
    </div>
  );
}
