import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { useListLetters, useDeleteLetter, ListLettersStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, PenLine, Copy, Trash2, ExternalLink,
  Loader2, RefreshCw, Mail, CheckCircle, MessageSquare,
  Eye, BookOpen, CalendarClock, Lock, Check, AlertTriangle, X
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type SortKey = "newest" | "oldest" | "recipient" | "recently_read";

function getStatusBadge(letter: any) {
  const isScheduledLocked = letter.scheduledUnlockAt && !letter.isUnlocked;
  const isScheduledFuture = letter.scheduledUnlockAt && letter.isUnlocked;
  if (isScheduledLocked) return <Badge className="bg-orange-500 text-white text-xs gap-1 shrink-0"><Lock className="w-3 h-3" />مقفلة</Badge>;
  if (isScheduledFuture && letter.status === "sent") return <Badge className="bg-purple-600 text-white text-xs gap-1 shrink-0"><CalendarClock className="w-3 h-3" />مجدولة</Badge>;
  switch (letter.status) {
    case "draft": return <Badge variant="secondary" className="text-xs shrink-0">مسودة</Badge>;
    case "sent": return <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0">أُرسلت</Badge>;
    case "read": return <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs shrink-0">قُرئت</Badge>;
    case "replied": return <Badge className="bg-[#C9A84C] hover:bg-[#b8943c] text-white text-xs shrink-0">تم الرد</Badge>;
    default: return <Badge variant="outline" className="text-xs shrink-0">{letter.status}</Badge>;
  }
}

function CopyButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    navigator.clipboard.writeText(`${window.location.origin}${base}/letter/${token}`);
    setCopied(true);
    toast.success("تم نسخ الرابط!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy} title="نسخ رابط الرسالة">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
    </Button>
  );
}

function DeleteConfirm({ onConfirm, onCancel, isPending }: { onConfirm: () => void; onCancel: () => void; isPending: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 bg-card/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-2 z-10 border border-destructive/30"
      onClick={e => e.stopPropagation()}
    >
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <span className="text-xs font-semibold text-destructive">حذف نهائي؟</span>
      <Button size="sm" variant="destructive" className="h-7 text-xs px-3" onClick={onConfirm} disabled={isPending}>
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "نعم، احذف"}
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={onCancel}>إلغاء</Button>
    </motion.div>
  );
}

function sortLetters(letters: any[], sort: SortKey) {
  return [...letters].sort((a, b) => {
    if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "recipient") return a.recipientName.localeCompare(b.recipientName, "ar");
    if (sort === "recently_read") {
      const ra = a.readAt ? new Date(a.readAt).getTime() : 0;
      const rb = b.readAt ? new Date(b.readAt).getTime() : 0;
      return rb - ra;
    }
    return 0;
  });
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListLettersStatus | "">("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useListLetters();
  const deleteMutation = useDeleteLetter();

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
      setConfirmDeleteId(null);
      toast.success("تم حذف الرسالة");
    } catch {
      toast.error("فشل الحذف، حاول مجدداً");
    }
  }, [deleteMutation, queryClient]);

  const allLetters = data?.letters || [];

  const filtered = allLetters.filter(l => {
    if (statusFilter) {
      if (statusFilter === "sent" && (l.scheduledUnlockAt && !l.isUnlocked)) return false;
      if (l.status !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!l.title.toLowerCase().includes(q) && !l.recipientName.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const letters = sortLetters(filtered, sort);

  const totalLetters = allLetters.length;
  const unreadLetters = allLetters.filter(l => !l.isRead && l.status !== "draft").length;
  const repliedLetters = allLetters.filter(l => l.status === "replied").length;
  const scheduledLetters = allLetters.filter(l => l.scheduledUnlockAt).length;

  return (
    <AdminLayout>
      <div className="space-y-5 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الرسائل", value: totalLetters, icon: Mail, color: "text-primary", bg: "bg-primary/10" },
            { label: "غير مقروءة", value: unreadLetters, icon: Eye, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "تم الرد عليها", value: repliedLetters, icon: MessageSquare, color: "text-[#C9A84C]", bg: "bg-amber-50" },
            { label: "مجدولة", value: scheduledLetters, icon: CalendarClock, color: "text-purple-600", bg: "bg-purple-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border-border/50 shadow-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-2xl md:text-3xl font-bold font-display">{value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
              <Input
                placeholder="ابحث برقم عنوان أو مستلم..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 h-11"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} className="h-11 w-11 shrink-0">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary flex-1 min-w-[120px]"
            >
              <option value="">جميع الحالات</option>
              <option value="draft">مسودة</option>
              <option value="sent">أُرسلت</option>
              <option value="read">قُرئت</option>
              <option value="replied">تم الرد</option>
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary flex-1 min-w-[120px]"
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="oldest">الأقدم أولاً</option>
              <option value="recipient">المستلم أ-ي</option>
              <option value="recently_read">آخر قراءة</option>
            </select>
            <Link href="/compose" className="flex-1 sm:flex-none">
              <Button variant="royal" className="h-10 gap-2 w-full sm:w-auto">
                <PenLine className="w-4 h-4" /> رسالة جديدة
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-destructive mb-4">فشل تحميل الرسائل</p>
            <Button variant="outline" onClick={() => refetch()}>إعادة المحاولة</Button>
          </div>
        ) : letters.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Mail className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg mb-4">{search || statusFilter ? "لا توجد رسائل مطابقة" : "لا توجد رسائل بعد"}</p>
            {!search && !statusFilter && (
              <Link href="/compose"><Button variant="royal">اكتب أول رسالة</Button></Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 border-b border-border/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-foreground text-xs">عنوان الرسالة</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground text-xs">المستلم</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground text-xs">الحالة</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground text-xs">آخر نشاط</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground text-xs">تاريخ الإنشاء</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground text-xs text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {letters.map((letter) => (
                      <tr
                        key={letter.id}
                        className="hover:bg-muted/25 transition-colors cursor-pointer relative"
                        onClick={() => setLocation(`/letters/${letter.id}`)}
                      >
                        <td className="px-4 py-3.5 font-medium max-w-[200px]">
                          <div className="flex items-center gap-2">
                            {letter.isRead
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              : <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                            <span className="truncate">{letter.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground truncate max-w-[130px]">{letter.recipientName}</td>
                        <td className="px-4 py-3.5">{getStatusBadge(letter)}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {letter.readAt
                            ? format(new Date(letter.readAt), "d MMM - HH:mm", { locale: ar })
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {format(new Date(letter.createdAt), "d MMM yyyy", { locale: ar })}
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5 relative">
                            <AnimatePresence>
                              {confirmDeleteId === letter.id && (
                                <DeleteConfirm
                                  onConfirm={() => handleDelete(letter.id)}
                                  onCancel={() => setConfirmDeleteId(null)}
                                  isPending={deleteMutation.isPending}
                                />
                              )}
                            </AnimatePresence>
                            {letter.status !== "draft" && <CopyButton token={letter.uniqueToken} />}
                            <Button variant="ghost" size="icon" className="h-9 w-9" title="فتح كزائر"
                              onClick={e => { e.stopPropagation(); const b = import.meta.env.BASE_URL.replace(/\/$/, ""); window.open(`${b}/letter/${letter.uniqueToken}`, '_blank'); }}>
                              <ExternalLink className="w-3.5 h-3.5 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" title="التفاصيل"
                              onClick={e => { e.stopPropagation(); setLocation(`/letters/${letter.id}`); }}>
                              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" title="حذف"
                              onClick={e => { e.stopPropagation(); setConfirmDeleteId(letter.id); }}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            <div className="md:hidden space-y-3">
              {letters.map((letter) => (
                <Card
                  key={letter.id}
                  className="border-border/50 shadow-sm cursor-pointer active:scale-[0.99] transition-all relative overflow-hidden"
                  onClick={() => setLocation(`/letters/${letter.id}`)}
                >
                  <AnimatePresence>
                    {confirmDeleteId === letter.id && (
                      <DeleteConfirm
                        onConfirm={() => handleDelete(letter.id)}
                        onCancel={() => setConfirmDeleteId(null)}
                        isPending={deleteMutation.isPending}
                      />
                    )}
                  </AnimatePresence>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {letter.isRead
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                          <h3 className="font-semibold text-sm truncate">{letter.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground me-6 truncate">إلى: {letter.recipientName}</p>
                      </div>
                      {getStatusBadge(letter)}
                    </div>
                    <div className="flex items-center justify-between mt-3" onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(letter.createdAt), "d MMM yyyy", { locale: ar })}
                      </span>
                      <div className="flex items-center gap-1">
                        {letter.status !== "draft" && <CopyButton token={letter.uniqueToken} />}
                        <Button variant="ghost" size="icon" className="h-9 w-9"
                          onClick={e => { e.stopPropagation(); const b = import.meta.env.BASE_URL.replace(/\/$/, ""); window.open(`${b}/letter/${letter.uniqueToken}`, '_blank'); }}>
                          <ExternalLink className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9"
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(letter.id); }}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
