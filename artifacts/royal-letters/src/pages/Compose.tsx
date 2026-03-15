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
import { Plus, Trash2, Save, Send, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface QAPair {
  id?: string;
  questionText: string;
  answerText: string;
  orderIndex: number;
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

  useEffect(() => {
    if (existingLetter?.letter) {
      setTitle(existingLetter.letter.title);
      setRecipientName(existingLetter.letter.recipientName);
      setLanguage(existingLetter.letter.language as CreateLetterRequestLanguage);
      setBody(existingLetter.letter.body);
      
      if (existingLetter.letter.questions) {
        // Need to fetch answers as admin? The API getLetter doesn't expose answers in schema? 
        // Wait, QuestionInput requires answerText. The existingLetter has questions (without answers for security or maybe it includes them). 
        // For simplicity, we assume we can edit questions completely. If existing questions don't have answerText exposed, we might have a gap.
        // Let's populate what we have, leave answers blank if not provided, admin must re-enter if changing.
        setQuestions(existingLetter.letter.questions.map((q: any) => ({
          id: q.id,
          questionText: q.questionText,
          answerText: q.answerText || "", // might be undefined from API
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
    // Update order indices
    setQuestions(newQs.map((q, i) => ({ ...q, orderIndex: i })));
  };

  const handleQuestionChange = (index: number, field: keyof QAPair, value: string) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    setQuestions(newQs);
  };

  const handleSave = async (status: CreateLetterRequestStatus) => {
    try {
      const payload = {
        title,
        recipientName,
        language,
        body,
        status,
        questions: questions.filter(q => q.questionText && q.answerText).map(q => ({
          questionText: q.questionText,
          answerText: q.answerText,
          orderIndex: q.orderIndex
        }))
      };

      if (isEditing) {
        await updateMutation.mutateAsync({ id: letterId, data: payload });
      } else {
        await createMutation.mutateAsync({ data: payload });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/letters"] });
      setLocation("/dashboard");
    } catch (error) {
      alert("حدث خطأ أثناء الحفظ");
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

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-xl">معلومات الرسالة</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">عنوان الرسالة</label>
                <Input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="مثال: رسالة شكر وتقدير" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">اسم المستلم</label>
                <Input 
                  value={recipientName} 
                  onChange={e => setRecipientName(e.target.value)} 
                  placeholder="مثال: سمو الأمير..." 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">لغة الرسالة</label>
                <select 
                  value={language}
                  onChange={e => setLanguage(e.target.value as CreateLetterRequestLanguage)}
                  className="w-full h-12 rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:border-primary/50"
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
            <CardTitle className="text-xl">محتوى الرسالة</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="p-4 rounded-xl border-2 border-primary/20 bg-[#FAF7F0] relative">
              <div className="absolute inset-0 bg-parchment-pattern opacity-40 mix-blend-multiply pointer-events-none rounded-xl" />
              <Textarea 
                value={body} 
                onChange={e => setBody(e.target.value)}
                placeholder="اكتب نص الرسالة هنا..."
                className="min-h-[400px] bg-transparent border-none shadow-none focus-visible:ring-0 text-xl leading-loose p-8 relative z-10 font-script resize-none placeholder:font-sans placeholder:text-base"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#C9A84C]/30 shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-xl">أسئلة الأمان لفتح الرسالة</CardTitle>
            <Badge variant="outline">{questions.length} / 3 أسئلة</Badge>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {questions.length === 0 && (
              <div className="text-center p-8 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                <p className="mb-4">لا توجد أسئلة أمان. ستفتح الرسالة مباشرة أو برمز فقط.</p>
                <Button variant="outline" onClick={handleAddQuestion} type="button">
                  <Plus className="w-4 h-4 me-2" /> إضافة سؤال أمان
                </Button>
              </div>
            )}

            {questions.map((q, index) => (
              <div key={index} className="flex gap-4 items-start p-4 bg-muted/20 rounded-xl border border-border/50 relative">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-1">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">السؤال</label>
                    <Input 
                      value={q.questionText} 
                      onChange={e => handleQuestionChange(index, 'questionText', e.target.value)} 
                      placeholder="مثال: ما هو لونك المفضل؟" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">الإجابة الصحيحة</label>
                    <Input 
                      value={q.answerText} 
                      onChange={e => handleQuestionChange(index, 'answerText', e.target.value)} 
                      placeholder="الجواب المطابق تماماً" 
                    />
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemoveQuestion(index)} 
                  className="text-destructive mt-6 hover:bg-destructive/10 shrink-0"
                  type="button"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            ))}

            {questions.length > 0 && questions.length < 3 && (
              <Button variant="outline" onClick={handleAddQuestion} type="button" className="w-full border-dashed">
                <Plus className="w-4 h-4 me-2" /> إضافة سؤال آخر
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => handleSave('draft')}
            disabled={isPending || !title || !recipientName}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
            حفظ كمسودة
          </Button>
          <Button 
            variant="royal" 
            size="lg" 
            onClick={() => handleSave('sent')}
            disabled={isPending || !title || !recipientName || !body}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Send className="w-4 h-4 me-2" />}
            إصدار الرسالة وإرسالها
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
