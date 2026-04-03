import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import {
  useCreateLetter,
  useUpdateLetter,
  useGetLetter,
  CreateLetterRequestLanguage,
  CreateLetterRequestStatus
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Send, Loader2, CalendarClock, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, addMinutes } from "date-fns";
import { ar } from "date-fns/locale";

interface QAPair {
  id?: string;
  questionText: string;
  answerText: string;
  orderIndex: number;
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Compose() {
  const [, params] = useRoute("/compose/:id");
  const letterId = params?.id;
  const isEditing = !!letterId;

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: existingLetter, isLoading: isFetching } = useGetLetter(letterId || "", {
    query: { enabled: isEditing }
  });

  const createMutation = useCreateLetter();
  const updateMutation = useUpdateLetter();

  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [language, setLanguage] = useState<CreateLetterRequestLanguage>("arabic");
  const [body, setBody] = useState("");
  const [questions, setQuestions] = useState<QAPair[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeValue(addMinutes(new Date(), 60)));
  const [saveError, setSaveError] = useState("");

  const minDatetime = toLocalDatetimeValue(addMinutes(new Date(), 1));

  useEffect(() => {
    if (existingLetter?.letter) {
      setTitle(existingLetter.letter.title);
      setRecipientName(existingLetter.letter.recipientName);
      setLanguage(existingLetter.letter.language as CreateLetterRequestLanguage);
      setBody(existingLetter.letter.body);

      const unlockAt = (existingLetter.letter as any).scheduledUnlockAt;
      if (unlockAt) {
        setScheduleEnabled(true);
        setScheduledAt(toLocalDatetimeValue(new Date(unlockAt)));
      }

      if (existingLetter.letter.questions) {
        setQuestions(existingLetter.letter.questions.map((q: any) => ({
          id: q.id,
          questionText: q.questionText,
          answerText: q.answerText || "",
          orderIndex: q.orderIndex
        })));
      }
    }
  }, [existingLetter]);

  const handleAddQuestion = () => {
    if (questions.length >= 3) return;
    setQuestions([...questions, { questionText: "", answerText: "", orderIndex: questions.length }]);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQs = [...questions];
    newQs.splice(index, 1);
    setQuestions(newQs.map((q, i) => ({ ...q, orderIndex: i })));
  };

  const handleQuestionChange = (index: number, field: keyof QAPair, value: string) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    setQuestions(newQs);
  };

  const handleSave = async (status: CreateLetterRequestStatus) => {
    setSaveError("");
    try {
      const scheduledUnlockAt = scheduleEnabled ? new Date(scheduledAt).toISOString() : null;
      const payload: any = {
        title,
        recipientName,
        language,
        body,
        status,
        questions: questions.filter(q => q.questionText && q.answerText).map(q => ({
          questionText: q.questionText,
          answerText: q.answerText,
          orderIndex: q.orderIndex
        })),
        scheduledUnlockAt,
      };

      if (isEditing) {
        await updateMutation.mutateAsync({ id: letterId, data: payload });
      } else {
        await createMutation.mutateAsync({ data: payload });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
      setLocation("/dashboard");
    } catch (error: any) {
      setSaveError("حدث خطأ أثناء الحفظ");
      console.error(error);
    }
  };

  if (isEditing && isFetching) {
    return (
      <AdminLayout>
        <div className="flex justify-center p-12">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const scheduleDate = scheduleEnabled && scheduledAt ? new Date(scheduledAt) : null;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {saveError && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl text-center">
            {saveError}
          </div>
        )}

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg md:text-xl">معلومات الرسالة</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">عنوان الرسالة</label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="مثال: رسالة شكر وتقدير"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">اسم المستلم</label>
                <Input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="مثال: سمو الأمير..."
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">لغة الرسالة</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as CreateLetterRequestLanguage)}
                  className="w-full h-11 rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="arabic">العربية</option>
                  <option value="english">English</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-lg md:text-xl">محتوى الرسالة</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="p-3 md:p-4 rounded-xl border-2 border-primary/20 bg-[#FAF7F0] relative">
              <div className="absolute inset-0 bg-parchment-pattern opacity-40 mix-blend-multiply pointer-events-none rounded-xl" />
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="اكتب نص الرسالة هنا..."
                className="min-h-[280px] md:min-h-[400px] bg-transparent border-none shadow-none focus-visible:ring-0 text-lg md:text-xl leading-loose p-4 md:p-8 relative z-10 font-script resize-none placeholder:font-sans placeholder:text-base"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary shrink-0" />
              تأجيل فتح الرسالة
            </CardTitle>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium text-muted-foreground">تفعيل</span>
              <div
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${scheduleEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${scheduleEnabled ? "right-0.5" : "left-0.5"}`} />
              </div>
            </label>
          </CardHeader>
          {scheduleEnabled && (
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">تاريخ ووقت الفتح</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={minDatetime}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full h-11 rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {scheduleDate && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    ستُفتح هذه الرسالة في:{" "}
                    <strong>{format(scheduleDate, "d MMMM yyyy 'الساعة' HH:mm", { locale: ar })}</strong>
                  </span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg md:text-xl">أسئلة الأمان</CardTitle>
            <Badge variant="outline">{questions.length} / 3 أسئلة</Badge>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {questions.length === 0 && (
              <div className="text-center p-6 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                <p className="mb-4 text-sm">لا توجد أسئلة أمان. ستفتح الرسالة مباشرة.</p>
                <Button variant="outline" onClick={handleAddQuestion} type="button">
                  <Plus className="w-4 h-4 me-2" /> إضافة سؤال أمان
                </Button>
              </div>
            )}

            {questions.map((q, index) => (
              <div key={index} className="flex gap-3 items-start p-4 bg-muted/20 rounded-xl border border-border/50 relative">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-1 text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">السؤال</label>
                    <Input
                      value={q.questionText}
                      onChange={e => handleQuestionChange(index, 'questionText', e.target.value)}
                      placeholder="مثال: ما هو لونك المفضل؟"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">الإجابة الصحيحة</label>
                    <Input
                      value={q.answerText}
                      onChange={e => handleQuestionChange(index, 'answerText', e.target.value)}
                      placeholder="الجواب المطابق تماماً"
                      className="h-11"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveQuestion(index)}
                  className="text-destructive mt-5 hover:bg-destructive/10 shrink-0 min-h-[44px] min-w-[44px]"
                  type="button"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {questions.length > 0 && questions.length < 3 && (
              <Button variant="outline" onClick={handleAddQuestion} type="button" className="w-full border-dashed min-h-[44px]">
                <Plus className="w-4 h-4 me-2" /> إضافة سؤال آخر
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleSave('draft')}
            disabled={isPending || !title || !recipientName}
            className="min-h-[44px]"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
            حفظ كمسودة
          </Button>
          <Button
            variant="royal"
            size="lg"
            onClick={() => handleSave('sent')}
            disabled={isPending || !title || !recipientName || !body}
            className="min-h-[44px]"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Send className="w-4 h-4 me-2" />}
            {scheduleEnabled ? "إصدار وجدولة الرسالة" : "إصدار الرسالة وإرسالها"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
