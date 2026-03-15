import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { PenLine, Inbox, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { useGetAuthMe, useAdminLogout } from "@workspace/api-client-react";
import { useEffect } from "react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: auth, isLoading, isError } = useGetAuthMe();
  const logoutMutation = useAdminLogout();

  useEffect(() => {
    if (!isLoading && (isError || !auth?.authenticated)) {
      setLocation("/login");
    }
  }, [isLoading, isError, auth, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth?.authenticated) {
    return null; // Will redirect
  }

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "صندوق الرسائل", icon: Inbox },
    { href: "/compose", label: "رسالة جديدة", icon: PenLine },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-l border-border shadow-xl z-10 flex flex-col shrink-0 relative overflow-hidden">
        {/* Subtle decorative background in sidebar */}
        <div className="absolute inset-0 opacity-10 bg-parchment-pattern mix-blend-multiply pointer-events-none" />
        
        <div className="p-6 border-b border-border/50 relative z-10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <h1 className="font-display text-xl font-bold text-gradient-gold">الديوان الملكي</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-2">لوحة التحكم</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 relative z-10">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="block">
                <span className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
                )}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 relative z-10">
          <button 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex items-center w-full gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl font-medium transition-all"
          >
            {logoutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-md flex items-center px-8 shrink-0 z-10">
          <h2 className="font-display text-xl text-foreground">
            {location === "/dashboard" ? "الرسائل الصادرة والواردة"
              : location.startsWith("/letters/") ? "تفاصيل الرسالة"
              : location.startsWith("/compose") ? "صياغة رسالة"
              : "الديوان الملكي"}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-8 z-0 relative">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
