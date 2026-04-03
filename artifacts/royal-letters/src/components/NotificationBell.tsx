import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Bell, X, Check, CheckCheck, MessageSquare, Mail, Unlock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  letterId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcon = (type: string) => {
  if (type === "new_reply") return <MessageSquare className="w-4 h-4 text-purple-500 shrink-0" />;
  if (type === "letter_read") return <Mail className="w-4 h-4 text-blue-500 shrink-0" />;
  if (type === "message_unlocked") return <Unlock className="w-4 h-4 text-amber-500 shrink-0" />;
  return <Bell className="w-4 h-4 text-muted-foreground shrink-0" />;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [, setLocation] = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }, [apiBase]);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch(`${apiBase}/api/notifications/read-all`, { method: "PUT", credentials: "include" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {} finally {
      setMarkingAll(false);
    }
  };

  const handleClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        await fetch(`${apiBase}/api/notifications/${notif.id}/read`, { method: "PUT", credentials: "include" });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {}
    }
    if (notif.letterId) {
      setLocation(`/letters/${notif.letterId}`);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-full mt-2 w-80 md:w-96 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            style={{ maxHeight: "420px" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> الإشعارات
                {unreadCount > 0 && (
                  <span className="bg-primary/15 text-primary text-xs px-1.5 py-0.5 rounded-full">{unreadCount} جديد</span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={markingAll}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors min-h-[32px]"
                  >
                    {markingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                    قراءة الكل
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 hover:bg-muted/60 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "348px" }}>
              {loading && notifications.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد إشعارات حتى الآن</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-right flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 ${
                      !notif.isRead ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {typeIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug text-right ${!notif.isRead ? "font-semibold" : "text-muted-foreground"}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
