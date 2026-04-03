import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { PenLine, Inbox, LogOut, Loader2, ShieldCheck, Settings, Menu, X } from "lucide-react";
import { useGetAuthMe, useAdminLogout } from "@workspace/api-client-react";
import { useEffect, useState } from "react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: auth, isLoading, isError } = useGetAuthMe();
  const logoutMutation = useAdminLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (isError || !auth?.authenticated)) {
      setLocation("/login");
    }
  }, [isLoading, isError, auth, setLocation]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth?.authenticated) return null;

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "صندوق الرسائل", icon: Inbox },
    { href: "/compose", label: "رسالة جديدة", icon: PenLine },
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ];

  const getTitle = () => {
    if (location === "/dashboard") return "الرسائل الصادرة والواردة";
    if (location.startsWith("/letters/")) return "تفاصيل الرسالة";
    if (location.startsWith("/compose")) return "صياغة رسالة";
    if (location === "/settings") return "الإعدادات الشخصية";
    return "الديوان الملكي";
  };

  const Sidebar = () => (
    <aside className={cn(
      "bg-card border-l border-border shadow-xl z-30 flex flex-col relative overflow-hidden",
      "fixed inset-y-0 right-0 w-64 transition-transform duration-300",
      "md:relative md:translate-x-0 md:shrink-0",
      sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
    )}>
      <div className="absolute inset-0 opacity-10 bg-parchment-pattern mix-blend-multiply pointer-events-none" />

      <div className="p-5 border-b border-border/50 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary shrink-0" />
          <div>
            <h1 className="font-display text-lg font-bold text-gradient-gold">الديوان الملكي</h1>
            <p className="text-xs text-muted-foreground">لوحة التحكم</p>
          </div>
        </div>
        <button className="md:hidden text-muted-foreground hover:text-foreground p-1" onClick={() => setSidebarOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 relative z-10">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="block">
              <span className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 min-h-[44px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-foreground hover:bg-primary/10 hover:text-primary"
              )}>
                <item.icon className="w-5 h-5 shrink-0" />
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
          className="flex items-center w-full gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl font-medium transition-all min-h-[44px]"
        >
          {logoutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        <header className="h-14 md:h-16 border-b border-border/50 bg-card/50 backdrop-blur-md flex items-center px-4 md:px-8 shrink-0 z-10 gap-3">
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-display text-lg md:text-xl text-foreground truncate">
            {getTitle()}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8 relative">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
