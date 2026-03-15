import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { useListLetters, useDeleteLetter, ListLettersStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, PenLine, Copy, Trash2, Eye, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListLettersStatus | "">("");
  
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useListLetters({ 
    search: search || undefined, 
    status: statusFilter ? (statusFilter as ListLettersStatus) : undefined 
  });
  
  const deleteMutation = useDeleteLetter();

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/letter/${token}`;
    navigator.clipboard.writeText(url);
    // Could add toast here
    alert("تم نسخ رابط الرسالة بنجاح!");
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء.")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary">مسودة</Badge>;
      case "sent": return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">أُرسلت</Badge>;
      case "read": return <Badge variant="success">قُرئت</Badge>;
      case "replied": return <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">تم الرد</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex gap-2 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="ابحث عن رسالة أو مستلم..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-4 pr-10"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-12 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">جميع الحالات</option>
              <option value="draft">مسودة</option>
              <option value="sent">أُرسلت</option>
              <option value="read">قُرئت</option>
              <option value="replied">تم الرد</option>
            </select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          
          <Link href="/compose">
            <Button variant="royal" className="gap-2 w-full md:w-auto">
              <PenLine className="w-4 h-4" />
              صياغة رسالة جديدة
            </Button>
          </Link>
        </div>

        {/* Letters List */}
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">عنوان الرسالة</th>
                  <th className="px-6 py-4 font-medium">المستلم</th>
                  <th className="px-6 py-4 font-medium">الحالة</th>
                  <th className="px-6 py-4 font-medium">تاريخ الإنشاء</th>
                  <th className="px-6 py-4 font-medium text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                ) : data?.letters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      لا توجد رسائل مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  data?.letters.map((letter) => (
                    <tr key={letter.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{letter.title}</td>
                      <td className="px-6 py-4">{letter.recipientName}</td>
                      <td className="px-6 py-4">{getStatusBadge(letter.status)}</td>
                      <td className="px-6 py-4 text-muted-foreground" dir="ltr">
                        {format(new Date(letter.createdAt), "yyyy-MM-dd HH:mm")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {letter.status !== 'draft' && (
                            <Button variant="ghost" size="icon" title="نسخ الرابط" onClick={() => copyToClipboard(letter.uniqueToken)}>
                              <Copy className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                          <Link href={`/letter/${letter.uniqueToken}`}>
                            <a target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="icon" title="معاينة كزائر">
                                <ExternalLink className="w-4 h-4 text-green-600" />
                              </Button>
                            </a>
                          </Link>
                          <Link href={`/compose/${letter.id}`}>
                            <Button variant="ghost" size="icon" title="تعديل">
                              <PenLine className="w-4 h-4 text-amber-600" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="حذف"
                            onClick={() => handleDelete(letter.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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
