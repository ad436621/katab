import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { useListLetters, useDeleteLetter, ListLettersStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search, PenLine, Copy, Trash2, Eye, ExternalLink,
  Loader2, RefreshCw, Mail, CheckCircle, MessageSquare, BookOpen
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListLettersStatus | "">("");
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useListLetters({
    search: search || undefined,
    status: statusFilter ? (statusFilter as ListLettersStatus) : undefined
  });

  const deleteMutation = useDeleteLetter();

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/letter/${token}`;
    navigator.clipboard.writeText(url);
    alert("تم نسخ رابط الرسالة بنجاح!");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع.")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
    }
  };

  const letters = data?.letters || [];
  const totalLetters = letters.length;
  const sentLetters = letters.filter(l => l.status !== "draft").length;
  const readLetters = letters.filter(l => l.isRead).length;
  const repliedLetters = letters.filter(l => l.status === "replied").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary" className="text-xs">مسودة</Badge>;
      case "sent": return <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs">أُرسلت</Badge>;
      case "read": return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">قُرئت</Badge>;
      case "replied": return <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-xs">تم الرد</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الرسائل", value: totalLetters, icon: Mail, color: "text-primary" },
            { label: "مُرسَلة", value: sentLetters, icon: Eye, color: "text-blue-600" },
            { label: "مَقروءة", value: readLetters, icon: CheckCircle, color: "text-green-600" },
            { label: "مع ردود", value: repliedLetters, icon: MessageSquare, color: "text-purple-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="text-3xl font-bold font-display">{value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex gap-2 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="ابحث عن رسالة أو مستلم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10 h-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">جميع الحالات</option>
              <option value="draft">مسودة</option>
              <option value="sent">أُرسلت</option>
              <option value="read">قُرئت</option>
              <option value="replied">تم الرد</option>
            </select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} className="h-10 w-10">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <Link href="/compose">
            <Button variant="royal" className="gap-2 h-10">
              <PenLine className="w-4 h-4" />
              صياغة رسالة جديدة
            </Button>
          </Link>
        </div>

        {/* Letters Table */}
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="px-6 py-3 font-medium">عنوان الرسالة</th>
                  <th className="px-6 py-3 font-medium">المستلم</th>
                  <th className="px-6 py-3 font-medium">الحالة</th>
                  <th className="px-6 py-3 font-medium">تاريخ القراءة</th>
                  <th className="px-6 py-3 font-medium">أُنشئت</th>
                  <th className="px-6 py-3 font-medium text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                ) : letters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                      <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>لا توجد رسائل بعد</p>
                      <Link href="/compose">
                        <Button variant="outline" size="sm" className="mt-3">اكتب أول رسالة</Button>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  letters.map((letter) => (
                    <tr
                      key={letter.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/letters/${letter.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {letter.isRead
                            ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            : <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          }
                          {letter.title}
                        </div>
                      </td>
                      <td className="px-6 py-4">{letter.recipientName}</td>
                      <td className="px-6 py-4">{getStatusBadge(letter.status)}</td>
                      <td className="px-6 py-4">
                        {letter.isRead && letter.readAt ? (
                          <span className="text-green-700 text-xs font-medium">
                            {format(new Date(letter.readAt), "d MMM yyyy - HH:mm", { locale: ar })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs" dir="ltr">
                        {format(new Date(letter.createdAt), "d MMM yyyy", { locale: ar })}
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {letter.status !== "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="نسخ الرابط"
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(letter.uniqueToken); }}
                            >
                              <Copy className="w-3.5 h-3.5 text-blue-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="فتح كزائر"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); window.open(`/letter/${letter.uniqueToken}`, '_blank'); }}
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="عرض التفاصيل"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); setLocation(`/letters/${letter.id}`); }}
                          >
                            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="حذف"
                            className="h-8 w-8"
                            onClick={(e) => handleDelete(letter.id, e)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
